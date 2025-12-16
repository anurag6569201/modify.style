import requests
import json
import logging
import os
from datetime import datetime

# --- CONFIGURATION ---
API_KEY = "YOUR_GOOGLE_API_KEY_HERE"  # Optional but recommended for full data
URL_TO_TEST = "https://www.cnn.com"   # Replace with your target URL
STRATEGY = "mobile"                   # 'mobile' or 'desktop'

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

class DeepPageSpeedAuditor:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

    def run_deep_audit(self, url):
        """
        Fetches ALL categories and extracts granular details for LLM analysis.
        """
        params = {
            "url": url,
            "strategy": STRATEGY,
            "key": self.api_key,
            # Fetch all 4 major categories
            "category": ["performance", "seo", "accessibility", "best-practices"]
        }

        logger.info(f"🚀 Starting deep audit for {url} ({STRATEGY})...")
        
        try:
            response = requests.get(self.base_url, params=params, timeout=120)
            response.raise_for_status()
            data = response.json()
            
            return self._process_for_llm(data, url)

        except Exception as e:
            logger.error(f"❌ Error: {e}")
            return None

    def _process_for_llm(self, data, url):
        """
        Cleans and structures the data specifically for LLM understanding.
        Removes binary data (screenshots) and passes full audit details.
        """
        lighthouse = data.get("lighthouseResult", {})
        audits = lighthouse.get("audits", {})
        categories = lighthouse.get("categories", {})
        
        # 1. High-Level Scores
        scores = {
            k: int(v.get("score", 0) * 100) 
            for k, v in categories.items() if v.get("score") is not None
        }

        # 2. Extract Actionable Audits (Only those that failed or have warnings)
        # We skip 'passed' audits to save token space for the LLM
        detailed_audits = []
        
        for audit_id, audit in audits.items():
            score = audit.get("score")
            score_display = audit.get("scoreDisplayMode")
            
            # We want:
            # - Audits with a score < 0.9 (Failing/Average)
            # - "informative" or "manual" audits that contain debug data
            # - We exclude strictly "binary" pass/fail if it passed (score=1)
            is_relevant = (score is not None and score < 0.9) or \
                          (score_display in ["informative", "notApplicable", "manual"])

            if is_relevant:
                # Extract the "Details" table if it exists
                # This is where the file URLs, line numbers, and wasted bytes live
                details = audit.get("details", {})
                
                # Remove heavy binary data from details (like screenshots)
                if "screenshot" in details:
                    del details["screenshot"]
                
                # Clean up items (truncate massive lists if necessary)
                items = details.get("items", [])
                if len(items) > 50:
                    items = items[:50]  # Limit to top 50 offenders to save tokens
                    details["note"] = "List truncated to top 50 items."
                
                detailed_audits.append({
                    "id": audit_id,
                    "title": audit.get("title"),
                    "description": audit.get("description"),
                    "score": score,
                    "displayValue": audit.get("displayValue"),
                    "details": details  # <--- THIS IS THE GOLD MINE FOR LLMs
                })

        # 3. Construct the Final Prompt Context
        llm_context = {
            "metadata": {
                "url": url,
                "strategy": STRATEGY,
                "timestamp": datetime.now().isoformat(),
                "user_agent": lighthouse.get("userAgent")
            },
            "scores": scores,
            "core_web_vitals": {
                "LCP": audits.get("largest-contentful-paint", {}).get("displayValue"),
                "CLS": audits.get("cumulative-layout-shift", {}).get("displayValue"),
                "INP": audits.get("interaction-to-next-paint", {}).get("displayValue"), # Use audit if field data missing
                "TBT": audits.get("total-blocking-time", {}).get("displayValue")
            },
            # This list contains the specific URLs and code snippets causing issues
            "failed_audits_and_diagnostics": detailed_audits 
        }

        return llm_context

# --- EXECUTION ---
if __name__ == "__main__":
    auditor = DeepPageSpeedAuditor(API_KEY)
    
    # Run the audit
    result = auditor.run_deep_audit(URL_TO_TEST)
    
    if result:
        # Save to a JSON file (Best for uploading to LLM)
        filename = f"pagespeed_llm_context_{int(datetime.now().timestamp())}.json"
        
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
            
        print(f"\n✅ SUCCESS! Full diagnostic data saved to: {filename}")
        print("You can now upload this JSON file to ChatGPT/Claude with the prompt below.")