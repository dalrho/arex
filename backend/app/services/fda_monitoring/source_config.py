"""
FDA Monitoring endpoints and configuration.
"""

FDA_API_BASE_URL = "https://www.federalregister.gov/api/v1/documents.json"
FDA_API_AGENCIES = ["food-and-drug-administration"]
RATE_LIMIT_DELAY_SECONDS = 1.0  # Safe delay between API requests
MAX_RETRIES = 3
BACKOFF_FACTOR = 2.0
