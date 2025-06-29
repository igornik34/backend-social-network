import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 10_000; // Размер пачки для вставки
const TOTAL_POSTS = 1_000_000;

async function generatePosts() {
    // Сначала получим всех существующих пользователей
    const users = await prisma.user.findMany({
        select: { id: true }
    });

    if (users.length === 0) {
        throw new Error('Нет пользователей в базе. Сначала создайте пользователей.');
    }

    console.log(`Начало генерации ${TOTAL_POSTS} постов...`);

    for (let i = 0; i < TOTAL_POSTS; i += BATCH_SIZE) {
        const batchSize = Math.min(BATCH_SIZE, TOTAL_POSTS - i);
        const posts = Array.from({ length: batchSize }, () => {
            const randomUser = users[Math.floor(Math.random() * users.length)];

            return {
                content: faker.lorem.paragraphs(1),
                images: Array.from({ length: faker.number.int({ min: 0, max: 4 }) }, () =>
                    faker.image.urlLoremFlickr({ category: 'nature' })
                ),
                authorId: randomUser.id,
                createdAt: faker.date.past({ years: 1 }),
            };
        });

        await prisma.post.createMany({
            data: posts,
            skipDuplicates: true,
        });

        console.log(`Добавлено ${i + batchSize} из ${TOTAL_POSTS} постов`);
    }

    console.log('Все посты успешно созданы!');
}

generatePosts()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });