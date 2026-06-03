import type { MarketNewsItem } from '@/types';
import { NewsCard } from './NewsCard';

interface NewsHeroProps {
  articles: MarketNewsItem[];
}

export function NewsHero({ articles }: NewsHeroProps) {
  if (!articles.length) return null;

  const [lead, ...rest] = articles;
  const side = rest.slice(0, 2);

  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <NewsCard article={lead} variant="hero" serifHeadline className="lg:col-span-7" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
        {side.map((article) => (
          <NewsCard key={article.id} article={article} variant="feature" />
        ))}
      </div>
    </section>
  );
}
