import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 10_000;
const TOTAL_COMMENTS = 2_000_000; // ~2 комментария на пост в среднем
const REPLY_PROBABILITY = 0.3; // Вероятность что комментарий будет ответом

async function generateComments() {
    // Получаем ID всех постов и пользователей
    const [posts, users] = await Promise.all([
        prisma.post.findMany({ select: { id: true }, take: 1_000_000 }),
        prisma.user.findMany({ select: { id: true } })
    ]);

    if (posts.length === 0 || users.length === 0) {
        throw new Error('Не найдены посты или пользователи');
    }

    console.log(`Начало генерации ${TOTAL_COMMENTS} комментариев...`);

    // Сначала создадим корневые комментарии
    const rootComments: string[] = [];

    for (let i = 0; i < TOTAL_COMMENTS; i += BATCH_SIZE) {
        const batchSize = Math.min(BATCH_SIZE, TOTAL_COMMENTS - i);
        const commentsBatch = [];

        for (let j = 0; j < batchSize; j++) {
            const isReply = rootComments.length > 0 && Math.random() < REPLY_PROBABILITY;
            const randomPost = posts[Math.floor(Math.random() * posts.length)];
            const randomUser = users[Math.floor(Math.random() * users.length)];

            const commentData = {
                content: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
                authorId: randomUser.id,
                postId: randomPost.id,
                createdAt: faker.date.between({
                    from: new Date('2023-01-01'),
                    to: new Date()
                }),
                parentId: isReply
                    ? rootComments[Math.floor(Math.random() * rootComments.length)]
                    : null
            };

            commentsBatch.push(commentData);
        }

        const createdComments = await prisma.$transaction(
            commentsBatch.map(comment =>
                prisma.comment.create({ data: comment })
            )
        );

        // Сохраняем ID корневых комментариев для ответов
        createdComments.forEach(comment => {
            if (!comment.parentId) {
                rootComments.push(comment.id);
            }
        });

        console.log(`Добавлено ${i + batchSize} из ${TOTAL_COMMENTS} комментариев`);
    }

    console.log('Все комментарии успешно созданы!');
}

generateComments()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });