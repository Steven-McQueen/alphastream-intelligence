import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/config/api';
import type { MarketNewsItem, NewsCategoryId } from '@/types';

const API_BASE = API_BASE_URL;

function mapArticle(article: any): MarketNewsItem {
  return {
    id: article.id || article.url || article.title || crypto.randomUUID(),
    headline: article.headline || article.title || '',
    summary: article.summary || article.text || '',
    source: article.source || article.publisher || article.site || '',
    publishedAt: article.publishedAt || article.publishedDate || '',
    category: (article.category || 'general') as MarketNewsItem['category'],
    sentiment: (article.sentiment || 'neutral') as MarketNewsItem['sentiment'],
    tickers: Array.isArray(article.tickers) ? article.tickers : [],
    url: article.url || '',
    image: article.image || '',
    site: article.site || '',
    author: article.author || '',
  };
}

export function useNewsFeed(category: NewsCategoryId = 'all', limit = 30) {
  return useQuery({
    queryKey: ['newsFeed', category, limit],
    queryFn: async (): Promise<MarketNewsItem[]> => {
      const response = await fetch(`${API_BASE}/api/news/feed?category=${category}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch news feed');
      const data = await response.json();
      return Array.isArray(data) ? data.map(mapArticle) : [];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}

export function useTopStories(limit = 12) {
  return useQuery({
    queryKey: ['topStories', limit],
    queryFn: async (): Promise<MarketNewsItem[]> => {
      const response = await fetch(`${API_BASE}/api/news/feed?category=all&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch top stories');
      const data = await response.json();
      return Array.isArray(data) ? data.map(mapArticle) : [];
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}

