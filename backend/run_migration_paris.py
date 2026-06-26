import os
import ssl
import pg8000
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Extraire l'ID du projet de l'URL Supabase
# https://higxxjeknsfxnhwnczjo.supabase.co -> higxxjeknsfxnhwnczjo
supabase_url = os.getenv("SUPABASE_URL", "")
project_id = supabase_url.replace("https://", "").replace(".supabase.co", "").strip()

if not project_id:
    project_id = "higxxjeknsfxnhwnczjo"

# Utiliser le pooler régional IPv4 de Francfort (eu-central-1)
db_host = "aws-0-eu-central-1.pooler.supabase.com"
db_port = 6543
# Le format de l'utilisateur pour le pooler de connexion est : postgres.[ID_PROJET]
db_user = f"postgres.{project_id}"
db_password = os.getenv("SUPABASE_DB_PASSWORD", "Success2027*!!!!")
db_name = "postgres"

print(f"Connexion à la base de données PostgreSQL TennisBetAI (via Pooler IPv4)...")
print(f"Hôte : {db_host}:{db_port}")
print(f"Utilisateur : {db_user}")

# Configurer le contexte SSL requis par Supabase
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

try:
    # Connexion avec SSL
    conn = pg8000.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name,
        ssl_context=ssl_context
    )
    cursor = conn.cursor()
    print("Connexion établie avec succès.")
    
    # Lire le fichier SQL de migration
    sql_file_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    print(f"Lecture du fichier SQL : {sql_file_path}")
    with open(sql_file_path, "r", encoding="utf-8") as f:
        sql_content = f.read()
        
    print("Exécution des instructions SQL...")
    cursor.execute(sql_content)
    
    conn.commit()
    print("Migration terminée avec succès ! Toutes les tables ont été créées.")
    
    # Vérification des tables créées
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
    tables = cursor.fetchall()
    print("\nTables présentes dans le schéma public :")
    for t in tables:
        print(f"- {t[0]}")
        
    cursor.close()
    conn.close()

except Exception as e:
    print(f"\nErreur lors de la migration : {e}")
