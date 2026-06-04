import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchAtlasSchema } from '@/lib/atlasApi';

/** Curated database table/relationship map (Intelligence → Database Overview). */
export function SchemaView() {
  const schemaQuery = useQuery({ queryKey: ['atlas-schema'], queryFn: fetchAtlasSchema });
  const tables = schemaQuery.data?.tables ?? [];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-3">
        <p className="text-sm text-muted-foreground">
          The core tables behind AlphaStream and how they relate.
        </p>
        {schemaQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {tables.map((tbl) => (
            <Card key={tbl.table} className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-sm">{tbl.table}</CardTitle>
                <p className="text-xs text-muted-foreground">{tbl.purpose}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {tbl.key_columns.map((c) => (
                    <Badge key={c} variant="outline" className="text-[0.65rem] font-mono">
                      {c}
                    </Badge>
                  ))}
                </div>
                {tbl.relationships.length > 0 && (
                  <ul className="text-[0.7rem] text-muted-foreground space-y-0.5">
                    {tbl.relationships.map((r) => <li key={r}>↳ {r}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
