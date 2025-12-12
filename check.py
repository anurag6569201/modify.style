import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
import time
import random

class StealthCrawler:
    def __init__(self, base_url):
        self.base_url = base_url
        self.visited_pages = set()
        self.domain_name = urlparse(base_url).netloc
        self.session = requests.Session()
        
        # 1. MIMIC A REAL BROWSER (The most important fix)
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://google.com'
        }
        self.session.headers.update(self.headers)

        # 2. SETUP ROBOTS.TXT CHECKER
        self.rp = RobotFileParser()
        self.rp.set_url(urljoin(base_url, "/robots.txt"))
        try:
            self.rp.read()
            print("Robots.txt read successfully.")
        except:
            print("Could not read robots.txt (ignoring rules).")

    def is_internal_link(self, url):
        parsed_url = urlparse(url)
        return parsed_url.netloc == "" or parsed_url.netloc == self.domain_name

    def can_fetch(self, url):
        """Check if robots.txt allows us to visit this page."""
        return self.rp.can_fetch(self.headers['User-Agent'], url)

    def crawl(self, url):
        if url in self.visited_pages:
            return
        
        # Check robots.txt permissions
        if not self.can_fetch(url):
            print(f"Blocked by robots.txt: {url}")
            return

        self.visited_pages.add(url)
        
        try:
            # 3. RANDOM DELAY (Act like a human)
            sleep_time = random.uniform(1.0, 3.0) 
            print(f"Crawling: {url} (Waiting {sleep_time:.2f}s...)")
            time.sleep(sleep_time)
            
            response = self.session.get(url, timeout=10)
            
            if "text/html" not in response.headers.get("Content-Type", ""):
                return

            soup = BeautifulSoup(response.text, "html.parser")

            for link in soup.find_all("a", href=True):
                href = link['href']
                full_url = urljoin(url, href).split('#')[0]
                
                if full_url.endswith("/"):
                    full_url = full_url[:-1]

                if (self.is_internal_link(full_url) and 
                    full_url not in self.visited_pages and 
                    full_url.startswith("http")):
                    
                    self.crawl(full_url)
                    
        except Exception as e:
            print(f"Error crawling {url}: {e}")

    def get_pages(self):
        return list(self.visited_pages)

if __name__ == "__main__":
    # CHANGE THIS to the target website
    target = "https://github.com"
    
    crawler = StealthCrawler(target)
    crawler.crawl(target)
    
    print("\n--- Found Pages ---")
    for page in crawler.get_pages():
        print(page)