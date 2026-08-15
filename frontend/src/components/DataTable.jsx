import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.jsx';
import { Skeleton } from './ui/skeleton.jsx';
import { Button } from './ui/button.jsx';
import { EmptyState } from './EmptyState.jsx';

/**
 * columns: [{ key, header, render?, className? }]
 * The four states the brief asks for live here, once: loading, error, empty, data.
 */
export function DataTable({ columns, rows, meta, isLoading, error, onPageChange, empty }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <EmptyState title="We could not load this" hint={error.message} />;
  }

  if (!rows?.length) {
    return <EmptyState title={empty?.title ?? 'Nothing here yet'} hint={empty?.hint} action={empty?.action} />;
  }

  const pages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>
                    {c.render ? c.render(row) : row[c.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{meta.total} total</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
            >
              Previous
            </Button>
            <span className="px-2 py-1.5">
              Page {meta.page} of {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= pages}
              onClick={() => onPageChange(meta.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
