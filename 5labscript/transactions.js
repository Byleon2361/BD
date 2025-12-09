// transactions.js — ФИНАЛЬНАЯ ВЕРСИЯ, РАБОТАЕТ НА ШАРДИНГЕ ЧЕРЕЗ MONGOS
print('=== ACID-ТРАНЗАКЦИЯ НА ШАРДИРОВАННОМ КЛАСТЕРЕ (3 коллекции) ===');

const session = db.getMongo().startSession();
session.startTransaction({
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" }
});

try {
    // 1. Вставляем статью
    const article = {
        title: "Шардированный кластер + транзакция = ЛЕГЕНДА! " + new Date(),
        content: "Эта статья создана в распределённой ACID-транзакции",
        category: "technology",
        author: { name: "Author_1 LastName_1", email: "author1@news.com" },
        metrics: { views: 0, likes: 0, shares: 0, comments_count: 0 },
        metadata: { publishDate: new Date(), isActive: true, tags: ["sharding", "transaction"] },
        hash: "sharding_tx_" + Date.now()
    };

    const res1 = session.getDatabase('news_aggregator').news.insertOne(article);
    print("Статья добавлена: " + res1.insertedId);

    // 2. Обновляем статистику автора
   const authorStatsRes = session.getDatabase('news_aggregator').authors_stats.updateOne(
        { _id: "author1@news.com" },  // ← теперь _id = email (можно так делать!)
        { 
            $inc: { totalArticles: 1, totalViews: 1000 },
            $set: { 
                authorEmail: "author1@news.com",
                authorName: "Author_1 LastName_1",
                lastArticleDate: new Date() 
            }
        },
        { upsert: true }
    );
    print("Автор обновлён: matched=" + authorStatsRes.matchedCount + ", upserted=" + (authorStatsRes.upsertedId ? "YES" : "NO"));

    // 3. Добавляем комментарий
    session.getDatabase('news_aggregator').comments.insertOne({
        articleId: res1.insertedId,
        articleTitle: article.title,
        user: "sharding_god",
        comment: "Транзакция прошла на шардированном кластере — это магия!",
        likes: 999,
        timestamp: new Date()
    });
    print("Комментарий добавлен");

    // Коммит
    session.commitTransaction();
    print("ТРАНЗАКЦИЯ УСПЕШНО ЗАВЕРШЕНА НА ШАРДИРОВАННОМ КЛАСТЕРЕ!");

} catch (e) {
    print("ТРАНЗАКЦИЯ ОТМЕНЕНА: " + e.message);
    session.abortTransaction();
} finally {
    session.endSession();
}

print("Проверьте коллекции: news, authors_stats, comments — всё атомарно!");