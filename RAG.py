import ollama, requests, numpy as np, pickle, os
from bs4 import BeautifulSoup
from numpy.linalg import norm

# Global storage
data = {}
embeddings = {}
model = "nous-hermes2:10.7b"
# llama3.1:8b -- fantastic, quick -- little worse than hermes2
#nous-hermes2:10.7b -- great, little slower
#qwen2.5:7b -- its ok


url_order = []  # Track embedding order

def scrape(url):
    soup = BeautifulSoup(requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}).content, 'html.parser')
    [s.decompose() for s in soup(['script', 'style'])]
    text = ' '.join(soup.get_text().split())
    chunks = [text[i:i+800] for i in range(0, len(text), 600)]
    return {'url': url, 'text': text, 'chunks': chunks}

def embed(chunks):
    return [ollama.embeddings(model=model, prompt=c)["embedding"] for c in chunks]

def search(query, k=8, url_filter=None):
    q_emb = ollama.embeddings(model=model, prompt=query)["embedding"]
    q_norm = norm(q_emb)
    scores = []
    urls_to_search = [url_order[url_filter-1]] if url_filter else embeddings.keys()
    for url in urls_to_search:
        for i, e in enumerate(embeddings[url]):
            scores.append((np.dot(q_emb, e)/(q_norm*norm(e)), url, data[url]['chunks'][i]))
    return sorted(scores, reverse=True)[:k]

def answer(question, url_num=None):
    if not data: return "No data loaded"
    chunks = search(question, url_filter=url_num)
    context = '\n\n'.join([f"[{c[1]}]:\n{c[2]}" for c in chunks])
    prompt = f"Answer based on this context:\n\n{context}\n\nQuestion: {question}\n\nAnswer:"
    return ollama.chat(model=model, messages=[{"role": "user", "content": prompt}])["message"]["content"]

def add_url(url):
    print(f"Adding {url}...")
    d = scrape(url)
    data[url] = d
    embeddings[url] = embed(d['chunks'])
    url_order.append(url)
    os.makedirs('embeddings', exist_ok=True)
    with open('embeddings/embeddings.pkl', 'wb') as f:
        pickle.dump({'data': data, 'embeddings': embeddings, 'url_order': url_order}, f)
    print(f"✓ Added {len(d['chunks'])} chunks")

def add_urls(urls):
    for url in urls: add_url(url)

def ask(question, url_num=None):
    #print(f"\nQ: {question}")
    print(f"A: {answer(question, url_num)}")

def load_embeddings(path='embeddings/embeddings.pkl'):
    global data, embeddings, url_order
    with open(path, 'rb') as f:
        saved = pickle.load(f)
        data, embeddings, url_order = saved['data'], saved['embeddings'], saved['url_order']
    print(f"✓ Loaded {len(url_order)} URLs")

def extract_requirements():
    import json
    results = []
    for i, url in enumerate(url_order, 1):
        prompt = """Extract job posting details and return ONLY valid JSON:

{
  "school": "",
  "position": "",
  "title": "",
  "location": "",
  "deadline": "YYYY-MM-DD",
  "link": "",
  "comments": "",
  "numRefs": 0,
  "materials": {
    "cover": false,
    "cv": false,
    "research": false,
    "teaching": false,
    "diversity": false,
    "publications": false,
    "course evals": false,
    "unique research statement": false
  }
}

Return ONLY the JSON object with no additional text:"""
        
        response = answer(prompt, url_num=i)
        try:
            # Parse the JSON string response into an actual object
            parsed_response = json.loads(response)
            results.append(parsed_response)
        except json.JSONDecodeError:
            print(f"Error parsing JSON for URL {i}: {response}")
            continue
    return results

def json():
    #load_embeddings() # remove if model is already loaded
    requirements = extract_requirements()

    # Structure the data for the web app's expected format
    structured_data = []
    for i, requirement in enumerate(requirements, 1):
        # Skip applications with missing critical information
        school = requirement.get("school", "").strip()
        position = requirement.get("position", "").strip()
        deadline = requirement.get("deadline", "").strip()
        
        # Skip if no school or position, or if deadline is placeholder
        if not school or not position or deadline == "YYYY-MM-DD":
            print(f"Skipping incomplete application {i}: school='{school}', position='{position}', deadline='{deadline}'")
            continue
        
        # Ensure each requirement has all required fields with defaults
        app_data = {
            "id": i,  # Add unique ID for each application
            "school": school,
            "position": position,
            "title": requirement.get("title", "").strip(),
            "location": requirement.get("location", "").strip(),
            "deadline": deadline,
            "link": requirement.get("link", "").strip(),
            "comments": requirement.get("comments", "").strip(),
            "numRefs": requirement.get("numRefs", 3),
            "status": "pending",  # Default status
            "contact": "",  # Default empty
            "connections": "",  # Default empty
            "refs": {},  # Default empty refs object
            "materials": requirement.get("materials", {}),  # Keep materials from extraction
            "customFieldValues": {},  # Default empty
            "customChecklistValues": {}  # Default empty
        }
        structured_data.append(app_data)

    # Create the properly structured output for the web app
    output_data = {
        "applications": structured_data,
        "config": {
            "referenceWriters": [],
            "materials": ["cover", "cv", "research", "teaching", "diversity", "publications", "course evals", "unique research statement"],
            "statusOptions": ["pending", "in-progress", "submitted"],
            "customFields": [],
            "customChecklists": []
        }
    }

    import json
    print(json.dumps(output_data, indent=2))






# Save embeddings
# add_urls(["url1", "url2", "url3"])

# Later, load instead of re-embedding
# load_embeddings()

# Ask about specific URL (1-indexed)
# ask("What is the deadline?", url_num=2)  # Searches only 2nd URL
# ask("General question")  # Searches all URLs

###############################################

# Example questions to ask

#ask("What schools have you been provided? List them all.")
#ask("What is the application deadline?")
#ask("What is the full list of required items?",2)
#ask("Do I need a host professor/sponsor?")

