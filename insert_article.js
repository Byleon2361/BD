const db = db.getSiblingDB('news_aggregator');

print('=== ДОБАВЛЕНИЕ НОВОЙ СТАТЬИ ===');

// Добавляем новую статью
try {
  const result = db.news.insertOne({
    title: 'Новые технологии 2024',
    author: 'tech_author_1',
    category: 'technology',
    metrics: { 
      views: 500, 
      likes: 100, 
      shares: 50 
    },
    published_at: new Date(),
    tags: ['tech', 'innovation', '2024'],
    content: 'Статья о новейших технологиях...'
  });
  
  print(`✅ Статья добавлена! ID: ${result.insertedId}`);
  print('📊 Проверьте Change Stream в первом терминале...');
} catch (error) {
  print(`❌ Ошибка: ${error.message}`);
}
