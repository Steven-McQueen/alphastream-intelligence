import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useMarket } from '@/contexts/MarketContext';
import { useStockDetail } from '@/contexts/StockDetailContext';
import { getIndexDisplayName } from '@/lib/indexMeta';

/** Deep-link `/market/:symbol` opens the index sheet, then lands on Market. */
export default function IndexDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { openIndexDetail } = useStockDetail();
  const { indices } = useMarket();

  useEffect(() => {
    const raw = decodeURIComponent(symbol || '');
    if (!raw) {
      navigate('/market', { replace: true });
      return;
    }
    const stripped = raw.replace(/^\^/, '');
    const match = indices.find((item) => {
      const s = item.symbol.replace(/^\^/, '');
      return item.symbol === raw || s === stripped;
    });
    openIndexDetail({
      symbol: match?.symbol ?? raw,
      name: match?.name ?? getIndexDisplayName(raw),
    });
    navigate('/market', { replace: true });
    // Open once per URL symbol so a later indices refresh cannot re-open the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-dim" />
    </div>
  );
}
