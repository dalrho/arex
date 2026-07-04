import os
import psycopg2


def seed_data():
    """
    Seeds database with initial demo data.
    Connects to the database using the DATABASE_URL environment variable.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL environment variable is not set.")
        return

    print("Connecting to database to seed demo data...")
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Insert a dummy organization workspace
        org_id = "default-org-id"
        org_name = "Acme Pharma Inc"
        
        cursor.execute(
            """
            INSERT INTO organizations (id, name)
            VALUES (%s, %s)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
            """,
            (org_id, org_name)
        )
        
        conn.commit()
        print(f"Successfully seeded organization: {org_name} ({org_id})")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error seeding database: {e}")


if __name__ == "__main__":
    seed_data()

