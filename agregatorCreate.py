import random
from datetime import datetime, timedelta

def generate_news_sql(filename='demo-big-20170815.sql', num_records=3000000):
    """
    Генерирует SQL файл с 3 млн записей для таблицы новостей
    """
    
    # Данные для генерации
    categories = ['politics', 'sports', 'technology', 'entertainment', 'business', 'health', 'science']
    sources = ['Reuters', 'AP', 'BBC', 'CNN', 'Al Jazeera', 'Bloomberg', 'TechCrunch', 'ESPN']
    
    # Стартовые данные для реалистичности
    base_titles = [
        "Breaking News", "Latest Update", "Exclusive Report", "Special Coverage",
        "Market Analysis", "Sports Roundup", "Tech Review", "Political Briefing"
    ]
    
    base_contents = [
        "Significant developments have occurred in this area.",
        "Experts are analyzing the latest trends and data.",
        "This event has drawn international attention.",
        "New research reveals important findings.",
        "Market participants are closely watching the situation."
    ]
    
    # Открываем файл для записи
    with open(filename, 'w', encoding='utf-8') as f:
        # Записываем заголовок SQL файла
        f.write("-- News Aggregator Data Generation\n")
        f.write("-- Generated on: {}\n".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        f.write("-- Total records: {:,}\n\n".format(num_records))
        
        # SQL для создания таблицы (если нужно)
        f.write("""
-- CREATE TABLE IF NOT EXISTS news (
--     id BIGINT PRIMARY KEY,
--     title VARCHAR(255) NOT NULL,
--     content TEXT,
--     category VARCHAR(50),
--     source VARCHAR(100),
--     publish_date DATETIME,
--     url VARCHAR(500),
--     author VARCHAR(100),
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

""")
        
        # Генерируем данные пачками для эффективности
        batch_size = 10000
        batches = num_records // batch_size
        
        print(f"Generating {num_records:,} records in {batches} batches...")
        
        for batch in range(batches):
            f.write("INSERT INTO news (id, title, content, category, source, publish_date, url, author) VALUES\n")
            
            batch_values = []
            for i in range(batch_size):
                record_num = batch * batch_size + i + 1
                
                # Генерируем данные для одной записи
                category = random.choice(categories)
                source = random.choice(sources)
                
                title = f"{random.choice(base_titles)} #{record_num} - {category.capitalize()}"
                content = f"{random.choice(base_contents)} This is news content for record {record_num}."
                
                # Генерируем случайную дату за последние 2 года
                days_ago = random.randint(0, 730)
                hours_ago = random.randint(0, 23)
                minutes_ago = random.randint(0, 59)
                publish_date = datetime.now() - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)
                
                url = f"https://news.example.com/{category}/{record_num}"
                author = f"Reporter{random.randint(1, 50)}"
                
                # Форматируем значения для SQL
                values = f"({record_num}, '{title}', '{content}', '{category}', '{source}', '{publish_date.strftime('%Y-%m-%d %H:%M:%S')}', '{url}', '{author}')"
                batch_values.append(values)
            
            # Записываем пачку записей
            f.write(",\n".join(batch_values))
            f.write(";\n\n")
            
            if (batch + 1) % 10 == 0:
                print(f"Progress: {((batch + 1) * batch_size):,} records generated")
        
        # Обрабатываем остаток записей (если num_records не кратен batch_size)
        remainder = num_records % batch_size
        if remainder > 0:
            f.write("INSERT INTO news (id, title, content, category, source, publish_date, url, author) VALUES\n")
            
            remainder_values = []
            for i in range(remainder):
                record_num = batches * batch_size + i + 1
                
                category = random.choice(categories)
                source = random.choice(sources)
                title = f"{random.choice(base_titles)} #{record_num} - {category.capitalize()}"
                content = f"{random.choice(base_contents)} This is news content for record {record_num}."
                
                days_ago = random.randint(0, 730)
                publish_date = datetime.now() - timedelta(days=days_ago)
                
                url = f"https://news.example.com/{category}/{record_num}"
                author = f"Reporter{random.randint(1, 50)}"
                
                values = f"({record_num}, '{title}', '{content}', '{category}', '{source}', '{publish_date.strftime('%Y-%m-%d %H:%M:%S')}', '{url}', '{author}')"
                remainder_values.append(values)
            
            f.write(",\n".join(remainder_values))
            f.write(";\n\n")
        
        print(f"Generation complete! File saved as: {filename}")

def main():
    # Настройки генерации
    output_filename = "news_data_3m.sql"
    number_of_records = 3000000
    
    # Запускаем генерацию
    generate_news_sql(output_filename, number_of_records)
    
    print(f"\nSQL file with {number_of_records:,} records has been created successfully!")
    print("You can import it using: mysql -u username -p database_name < news_data_3m.sql")

if __name__ == "__main__":
    main()
