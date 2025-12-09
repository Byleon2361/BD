const db = db.getSiblingDB('news_aggregator');

print('=== ПРОВЕРКА DATA MART ===');

// 1. Проверим содержимое data mart
const stats = db.authors_daily_stats.find().toArray();

print(`Всего записей в data mart: ${stats.length}\n`);

if (stats.length > 0) {
  print('📊 СОДЕРЖИМОЕ DATA MART:');
  stats.forEach((s, i) => {
    print(`${i + 1}. Автор: ${s._id.author || 'Нет автора'}, Дата: ${s._id.date}`);
    print(`   📝 Статей: ${s.article_count}, 👁️ Просмотры: ${s.total_views}, 👍 Лайки: ${s.total_likes}`);
    print(`   🏷️  Категории: ${s.categories ? s.categories.join(', ') : 'Нет'}`);
    print('');
  });
} else {
  print('Data mart пока пуст. Добавьте больше статей с полем "author".');
}

// 2. Проверим исходные данные
print('=== ИСХОДНЫЕ ДАННЫЕ ИЗ NEWS ===');
const articles = db.news.find({}, { title: 1, author: 1, category: 1, 'metrics.views': 1 }).toArray();

print(`Всего статей в news: ${articles.length}`);
articles.forEach((article, i) => {
  print(`${i + 1}. "${article.title}"`);
  print(`   Автор: ${article.author || 'Нет'}, Категория: ${article.category || 'Нет'}`);
  print(`   Просмотры: ${article.metrics?.views || 0}`);
  print('');
});
