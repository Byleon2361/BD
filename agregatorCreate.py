import random
from datetime import datetime, timedelta

def generate_complete_database(filename='complete_news_database.sql', num_news=3000000):
    """
    Генерирует полную базу данных с нормализованной структурой и 3 млн новостей для PostgreSQL
    """
    
    # Данные для генерации
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
    
    # Генерируем авторов
    authors = []
    for i in range(1, 101):
        authors.append((
            f'Author_{i}',
            f'LastName_{i}',
            f'author{i}@news.com',
            f'Bio for author {i} with experience in journalism'
        ))
    
    tags = [
        'breaking', 'exclusive', 'analysis', 'opinion', 'interview',
        'election', 'market', 'startup', 'football', 'basketball',
        'film', 'music', 'medical', 'research', 'innovation'
    ]
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write("-- Complete News Database Generation (PostgreSQL)\n")
        f.write("-- Generated on: {}\n".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        f.write("-- Total news records: {:,}\n\n".format(num_news))
        
        # Создание таблиц для PostgreSQL
        f.write("""
-- Создание таблицы категорий
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы источников
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    website_url VARCHAR(500),
    country VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы авторов
CREATE TABLE IF NOT EXISTS authors (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы новостей (основная таблица с 3 млн записей)
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

-- Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_news_publish_date ON news(publish_date);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category_id);
CREATE INDEX IF NOT EXISTS idx_news_views ON news(views_count);
CREATE INDEX IF NOT EXISTS idx_news_active ON news(is_active) WHERE is_active = TRUE;

-- Таблица тегов
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связующая таблица новости-теги
CREATE TABLE IF NOT EXISTS news_tags (
    news_id BIGINT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (news_id, tag_id),
    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Таблица комментариев
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    news_id BIGINT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE
);

-- Индексы для комментариев
CREATE INDEX IF NOT EXISTS idx_comments_news_id ON comments(news_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

\n""")
        
        # Заполняем справочные таблицы
        print("Generating reference tables...")
        
        # Категории
        f.write("-- Insert categories\n")
        f.write("INSERT INTO categories (name, description) VALUES\n")
        category_values = []
        for i, (name, desc) in enumerate(categories, 1):
            category_values.append(f"('{name}', '{desc}')")
        f.write(",\n".join(category_values))
        f.write(";\n\n")
        
        # Источники
        f.write("-- Insert sources\n")
        f.write("INSERT INTO sources (name, website_url, country) VALUES\n")
        source_values = []
        for i, (name, url, country) in enumerate(sources, 1):
            source_values.append(f"('{name}', '{url}', '{country}')")
        f.write(",\n".join(source_values))
        f.write(";\n\n")
        
        # Авторы
        f.write("-- Insert authors\n")
        f.write("INSERT INTO authors (first_name, last_name, email, bio) VALUES\n")
        author_values = []
        for i, (first_name, last_name, email, bio) in enumerate(authors, 1):
            author_values.append(f"('{first_name}', '{last_name}', '{email}', '{bio}')")
        f.write(",\n".join(author_values))
        f.write(";\n\n")
        
        # Теги
        f.write("-- Insert tags\n")
        f.write("INSERT INTO tags (name) VALUES\n")
        tag_values = [f"('{tag}')" for tag in tags]
        f.write(",\n".join(tag_values))
        f.write(";\n\n")
        
        # Генерируем 3 млн новостей (пачками для PostgreSQL)
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
                
                # Случайные данные
                category_id = random.randint(1, len(categories))
                source_id = random.randint(1, len(sources))
                author_id = random.randint(1, len(authors))
                
                title_type = random.choice(base_titles)
                title = f"{title_type} #{record_num} - {categories[category_id-1][0].capitalize()}"
                
                content = f"{random.choice(base_contents)} This is detailed content for news record {record_num}. " + \
                         f"The article discusses important aspects of {categories[category_id-1][0]} and provides " + \
                         f"comprehensive analysis based on recent developments."
                
                # Случайная дата за последние 3 года
                days_ago = random.randint(0, 1095)  # 3 года
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
        
        # Триггер для обновления updated_at (PostgreSQL)
        f.write("""
-- Создание функции для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создание триггера для news таблицы
CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

\n""")
        
        # Генерируем связи новости-теги
        print("Generating news-tags relationships...")
        f.write("-- Insert news-tags relationships\n")
        
        tags_per_news = 3
        total_tags = num_news * tags_per_news
        
        tag_batches = total_tags // 50000
        
        for tag_batch in range(tag_batches):
            f.write("INSERT INTO news_tags (news_id, tag_id) VALUES\n")
            tag_values = []
            
            for i in range(50000):
                news_id = random.randint(1, num_news)
                tag_id = random.randint(1, len(tags))
                tag_values.append(f"({news_id}, {tag_id})")
            
            f.write(",\n".join(tag_values))
            f.write(" ON CONFLICT (news_id, tag_id) DO NOTHING;\n\n")
            
            if (tag_batch + 1) % 20 == 0:
                print(f"Tags progress: {((tag_batch + 1) * 50000):,} relationships generated")
        
        # Генерируем комментарии
        print("Generating comments...")
        f.write("-- Insert comments\n")
        
        comments_per_news = 5
        total_comments = num_news * comments_per_news // 2
        
        comment_batches = total_comments // 50000
        
        for comment_batch in range(comment_batches):
            f.write("INSERT INTO comments (news_id, user_name, email, content, likes_count) VALUES\n")
            comment_values = []
            
            for i in range(50000):
                news_id = random.randint(1, num_news)
                user_num = random.randint(1, 100000)
                comment_values.append(
                    f"({news_id}, 'User_{user_num}', 'user{user_num}@email.com', 'This is a comment on news #{news_id}. Interesting content!', {random.randint(0, 50)})"
                )
            
            f.write(",\n".join(comment_values))
            f.write(";\n\n")
            
            if (comment_batch + 1) % 20 == 0:
                print(f"Comments progress: {((comment_batch + 1) * 50000):,} comments generated")
        
        # Анализ таблиц для оптимизации
        f.write("""
-- Анализ таблиц для оптимизации запросов
ANALYZE categories;
ANALYZE sources;
ANALYZE authors;
ANALYZE news;
ANALYZE tags;
ANALYZE news_tags;
ANALYZE comments;

""")
        
        print(f"\nGeneration complete! File saved as: {filename}")

def generate_business_queries(filename='business_queries.sql'):
    """
    Генерирует файл с бизнес-запросами для PostgreSQL
    """
    
    queries = """-- ============================================
-- BUSINESS QUERIES FOR NEWS DATABASE (PostgreSQL)
-- ============================================

-- АГРЕГИРУЮЩИЕ ЗАПРОСЫ (5 штук)

-- 1. Количество новостей по категориям
SELECT c.name as category, COUNT(n.id) as news_count,
       AVG(n.views_count) as avg_views,
       MAX(n.views_count) as max_views
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.is_active = TRUE
GROUP BY c.id, c.name
ORDER BY news_count DESC;

-- 2. Статистика по авторам
SELECT a.first_name, a.last_name,
       COUNT(n.id) as articles_count,
       SUM(n.views_count) as total_views,
       AVG(n.views_count) as avg_views_per_article,
       SUM(n.likes_count) as total_likes
FROM authors a
JOIN news n ON a.id = n.author_id
GROUP BY a.id, a.first_name, a.last_name
HAVING COUNT(n.id) > 10
ORDER BY total_views DESC;

-- 3. Активность по месяцам
SELECT EXTRACT(YEAR FROM publish_date) as year, 
       EXTRACT(MONTH FROM publish_date) as month,
       COUNT(*) as articles_count,
       SUM(views_count) as total_views,
       AVG(views_count) as avg_views
FROM news
WHERE publish_date >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY EXTRACT(YEAR FROM publish_date), EXTRACT(MONTH FROM publish_date)
ORDER BY year DESC, month DESC;

-- 4. Популярность тегов
SELECT t.name as tag_name,
       COUNT(nt.news_id) as usage_count,
       AVG(n.views_count) as avg_views
FROM tags t
JOIN news_tags nt ON t.id = nt.tag_id
JOIN news n ON nt.news_id = n.id
GROUP BY t.id, t.name
ORDER BY usage_count DESC;

-- 5. Эффективность источников
SELECT s.name as source,
       COUNT(n.id) as articles_count,
       SUM(n.views_count) as total_views,
       AVG(n.views_count) as avg_views,
       SUM(n.likes_count) as total_likes
FROM sources s
JOIN news n ON s.id = n.source_id
GROUP BY s.id, s.name
ORDER BY avg_views DESC;

-- ОКОННЫЕ ФУНКЦИИ (5 штук)

-- 1. Рейтинг новостей внутри категорий
SELECT n.title, c.name as category, n.views_count,
       RANK() OVER (PARTITION BY n.category_id ORDER BY n.views_count DESC) as rank_in_category,
       DENSE_RANK() OVER (ORDER BY n.views_count DESC) as global_rank
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.is_active = TRUE
ORDER BY c.name, rank_in_category;

-- 2. Сравнение с предыдущей новостью автора
SELECT a.first_name, a.last_name, n.title, n.publish_date, n.views_count,
       LAG(n.views_count) OVER (PARTITION BY n.author_id ORDER BY n.publish_date) as prev_views,
       n.views_count - LAG(n.views_count) OVER (PARTITION BY n.author_id ORDER BY n.publish_date) as views_diff
FROM news n
JOIN authors a ON n.author_id = a.id
ORDER BY a.id, n.publish_date;

-- 3. Накопительный итог просмотров по месяцам
SELECT EXTRACT(YEAR FROM publish_date) as year, 
       EXTRACT(MONTH FROM publish_date) as month,
       SUM(views_count) as monthly_views,
       SUM(SUM(views_count)) OVER (ORDER BY EXTRACT(YEAR FROM publish_date), EXTRACT(MONTH FROM publish_date)) as cumulative_views
FROM news
GROUP BY EXTRACT(YEAR FROM publish_date), EXTRACT(MONTH FROM publish_date)
ORDER BY year, month;

-- 4. Процентное соотношение просмотров от категории
SELECT n.title, c.name as category, n.views_count,
       ROUND(n.views_count * 100.0 / SUM(n.views_count) OVER (PARTITION BY n.category_id), 2) as percent_of_category
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.views_count > 0;

-- 5. Скользящее среднее просмотров за 7 дней
SELECT publish_date, views_count,
       AVG(views_count) OVER (ORDER BY publish_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7d
FROM news
WHERE publish_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY publish_date;

-- ЗАПРОСЫ С ОБЪЕДИНЕНИЕМ ТАБЛИЦ

-- 2 таблицы (2 запроса)
-- 1. Новости с именами категорий
SELECT n.title, n.publish_date, n.views_count, c.name as category
FROM news n
JOIN categories c ON n.category_id = c.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY n.views_count DESC
LIMIT 20;

-- 2. Авторы и их статистика
SELECT a.first_name, a.last_name, 
       COUNT(n.id) as articles_count,
       AVG(n.views_count) as avg_views
FROM authors a
LEFT JOIN news n ON a.id = n.author_id
GROUP BY a.id, a.first_name, a.last_name
ORDER BY articles_count DESC;

-- 3 таблицы (4 запроса)
-- 1. Новости с категориями и источниками
SELECT n.title, c.name as category, s.name as source, n.publish_date
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN sources s ON n.source_id = s.id
WHERE n.is_active = TRUE
ORDER BY n.publish_date DESC
LIMIT 15;

-- 2. Комментарии с информацией о новостях
SELECT n.title, c.user_name, c.content, c.created_at as comment_date
FROM comments c
JOIN news n ON c.news_id = n.id
WHERE c.is_approved = TRUE
ORDER BY c.created_at DESC
LIMIT 20;

-- 3. Авторы, их новости и категории
SELECT a.first_name, a.last_name, n.title, c.name as category
FROM authors a
JOIN news n ON a.id = n.author_id
JOIN categories c ON n.category_id = c.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '1 month'
ORDER BY n.publish_date DESC;

-- 4. Новости с тегами и категориями
SELECT n.title, c.name as category, STRING_AGG(t.name, ', ') as tags
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN news_tags nt ON n.id = nt.news_id
JOIN tags t ON nt.tag_id = t.id
GROUP BY n.id, n.title, c.name
ORDER BY n.publish_date DESC
LIMIT 15;

-- 4 таблицы (1 запрос)
SELECT n.title, n.publish_date, n.views_count,
       c.name as category,
       s.name as source,
       a.first_name, a.last_name as author,
       STRING_AGG(DISTINCT t.name, ', ') as tags
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN sources s ON n.source_id = s.id
JOIN authors a ON n.author_id = a.id
LEFT JOIN news_tags nt ON n.id = nt.news_id
LEFT JOIN tags t ON nt.tag_id = t.id
WHERE n.publish_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY n.id, n.title, n.publish_date, n.views_count, c.name, s.name, a.first_name, a.last_name
ORDER BY n.views_count DESC
LIMIT 10;

-- 5 таблиц (1 запрос)
SELECT n.title, n.publish_date, n.views_count, n.likes_count,
       c.name as category,
       s.name as source,
       a.first_name || ' ' || a.last_name as author,
       STRING_AGG(DISTINCT t.name, ', ') as tags,
       COUNT(cm.id) as comments_count,
       AVG(LENGTH(cm.content)) as avg_comment_length
FROM news n
JOIN categories c ON n.category_id = c.id
JOIN sources s ON n.source_id = s.id
JOIN authors a ON n.author_id = a.id
LEFT JOIN news_tags nt ON n.id = nt.news_id
LEFT JOIN tags t ON nt.tag_id = t.id
LEFT JOIN comments cm ON n.id = cm.news_id
WHERE n.publish_date BETWEEN '2023-01-01' AND CURRENT_DATE
GROUP BY n.id, n.title, n.publish_date, n.views_count, n.likes_count,
         c.name, s.name, a.first_name, a.last_name
HAVING COUNT(cm.id) > 0
ORDER BY n.views_count DESC
LIMIT 10;
"""
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(queries)
    
    print(f"Business queries saved as: {filename}")

def main():
    # Генерируем полную базу данных для PostgreSQL
    generate_complete_database("complete_news_database_postgres.sql", 100000)  # Уменьшил до 100k для теста
    
    # Генерируем бизнес-запросы для PostgreSQL
    generate_business_queries("business_queries_postgres.sql")
    
    print("\n" + "="*50)
    print("ГЕНЕРАЦИЯ ДЛЯ POSTGRESQL ЗАВЕРШЕНА!")
    print("="*50)
    print("Созданы файлы:")
    print("1. complete_news_database_postgres.sql - База данных для PostgreSQL")
    print("2. business_queries_postgres.sql - Бизнес-запросы для PostgreSQL")
    print("\nДля импорта выполните:")
    print("docker exec -i bd-postgres-1 psql -U postgres -d news_aggregator -f - < complete_news_database_postgres.sql")

if __name__ == "__main__":
    main()