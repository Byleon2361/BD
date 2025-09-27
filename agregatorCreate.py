import random
from datetime import datetime, timedelta

def generate_complete_database(filename='complete_news_database.sql', num_news=3000000):
    """
    Generates a complete database with a normalized structure and 3 million news records for PostgreSQL
    """
   
    # Data for generation
    categories = [
        ('politics', 'Political news and government affairs'),
        ('sports', 'Sports events and competitions'),
        ('technology', 'IT and technology innovations'),
        ('entertainment', 'Movies, music and entertainment'),
        ('business', 'Business and economic news'),
        ('health', 'Healthcare and medicine'),
        ('science', 'Scientific discoveries and research')
    ]
   
    sources = [
        ('Reuters', 'https://reuters.com', 'International'),
        ('Associated Press', 'https://apnews.com', 'USA'),
        ('BBC News', 'https://bbc.com', 'UK'),
        ('CNN', 'https://cnn.com', 'USA'),
        ('Al Jazeera', 'https://aljazeera.com', 'Qatar'),
        ('Bloomberg', 'https://bloomberg.com', 'USA'),
        ('TechCrunch', 'https://techcrunch.com', 'USA'),
        ('ESPN', 'https://espn.com', 'USA')
    ]
   
    # Generate authors
    authors = []
    for i in range(1, 101):
        authors.append((
            f'Author_{i}',
            f'LastName_{i}',
            f'author{i}@news.com',
            f'Bio for author {i} with experience in journalism'
        ))
   
    with open(filename, 'w', encoding='utf-8') as f:
        f.write("-- Complete News Database Generation (PostgreSQL)\n")
        f.write("-- Generated on: {}\n".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        f.write("-- Total news records: {:,}\n\n".format(num_news))
       
        # Create tables for PostgreSQL
        f.write("""
-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    website_url VARCHAR(500),
    country VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create authors table
CREATE TABLE IF NOT EXISTS authors (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create news table (main table with 3 million records)
CREATE TABLE IF NOT EXISTS news (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category_id INT,
    source_id INT,
    author_id INT,
    publish_date TIMESTAMP NOT NULL,
    url VARCHAR(500) UNIQUE,
    views_count INT DEFAULT 0,
    likes_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (source_id) REFERENCES sources(id),
    FOREIGN KEY (author_id) REFERENCES authors(id)
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_news_publish_date ON news(publish_date);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category_id);
CREATE INDEX IF NOT EXISTS idx_news_views ON news(views_count);
CREATE INDEX IF NOT EXISTS idx_news_active ON news(is_active) WHERE is_active = TRUE;
\n""")
       
        # Populate reference tables
        print("Generating reference tables...")
       
        # Categories
        f.write("-- Insert categories\n")
        f.write("INSERT INTO categories (name, description) VALUES\n")
        category_values = []
        for i, (name, desc) in enumerate(categories, 1):
            category_values.append(f"('{name}', '{desc}')")
        f.write(",\n".join(category_values))
        f.write(";\n\n")
       
        # Sources
        f.write("-- Insert sources\n")
        f.write("INSERT INTO sources (name, website_url, country) VALUES\n")
        source_values = []
        for i, (name, url, country) in enumerate(sources, 1):
            source_values.append(f"('{name}', '{url}', '{country}')")
        f.write(",\n".join(source_values))
        f.write(";\n\n")
       
        # Authors
        f.write("-- Insert authors\n")
        f.write("INSERT INTO authors (first_name, last_name, email, bio) VALUES\n")
        author_values = []
        for i, (first_name, last_name, email, bio) in enumerate(authors, 1):
            author_values.append(f"('{first_name}', '{last_name}', '{email}', '{bio}')")
        f.write(",\n".join(author_values))
        f.write(";\n\n")
       
        # Generate 3 million news records
        print("Generating 3 million news records...")
       
        base_titles = [
            "Breaking News", "Latest Update", "Exclusive Report", "Special Coverage",
            "Market Analysis", "Sports Roundup", "Tech Review", "Political Briefing",
            "In-Depth Investigation", "Weekly Summary", "Expert Opinion", "Live Report"
        ]
       
        base_contents = [
            "Significant developments have occurred in this area with far-reaching implications.",
            "Experts are analyzing the latest trends and data to provide comprehensive insights.",
            "This event has drawn international attention from various stakeholders.",
            "New research reveals important findings that could change current understanding.",
            "Market participants are closely watching the situation for potential opportunities."
        ]
       
        batch_size = 10000
        batches = num_news // batch_size
       
        for batch in range(batches):
            f.write(f"-- Batch {batch + 1}/{batches}\n")
            f.write("INSERT INTO news (title, content, category_id, source_id, author_id, publish_date, url, views_count, likes_count) VALUES\n")
           
            batch_values = []
            for i in range(batch_size):
                record_num = batch * batch_size + i + 1
               
                # Random data
                category_id = random.randint(1, len(categories))
                source_id = random.randint(1, len(sources))
                author_id = random.randint(1, len(authors))
               
                title_type = random.choice(base_titles)
                title = f"{title_type} #{record_num} - {categories[category_id-1][0].capitalize()}"
               
                content = f"{random.choice(base_contents)} This is detailed content for news record {record_num}. " + \
                         f"The article discusses important aspects of {categories[category_id-1][0]} and provides " + \
                         f"comprehensive analysis based on recent developments."
               
                # Random date within the last 3 years
                days_ago = random.randint(0, 1095) # 3 years
                hours_ago = random.randint(0, 23)
                publish_date = datetime.now() - timedelta(days=days_ago, hours=hours_ago)
               
                url = f"https://newsportal.com/{categories[category_id-1][0]}/{record_num}"
                views_count = random.randint(0, 50000)
                likes_count = random.randint(0, 1000)
               
                values = f"('{title}', '{content}', {category_id}, {source_id}, {author_id}, '{publish_date.strftime('%Y-%m-%d %H:%M:%S')}', '{url}', {views_count}, {likes_count})"
                batch_values.append(values)
           
            f.write(",\n".join(batch_values))
            f.write(";\n\n")
           
            if (batch + 1) % 10 == 0:
                print(f"Progress: {((batch + 1) * batch_size):,} news records generated")
       
        # Trigger for updating updated_at
        f.write("""
-- Create function for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
-- Create trigger for news table
CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
\n""")
       
        # Analyze tables for optimization
        f.write("""
-- Analyze tables for query optimization
ANALYZE categories;
ANALYZE sources;
ANALYZE authors;
ANALYZE news;
""")
       
        print(f"\nGeneration complete! File saved as: {filename}")

def main():
    # Generate complete database for PostgreSQL
    generate_complete_database("complete_news_database_postgres.sql", 3000000)
   
    print("\n" + "="*50)
    print("GENERATION FOR POSTGRESQL COMPLETED!")
    print("="*50)
    print("Created file:")
    print("1. complete_news_database_postgres.sql - Database for PostgreSQL")
    print("\nTo import, execute:")
    print("docker exec -i bd-postgres-1 psql -U postgres -d news_aggregator -f - < complete_news_database_postgres.sql")

if __name__ == "__main__":
    main()