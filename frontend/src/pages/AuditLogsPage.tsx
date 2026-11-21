import { useEffect, useState, type FormEvent } from 'react';
import { auditLogsApi, type AuditLog, type AuditLogPage } from '../api/auditLogsApi';
import { toApiError } from '../api/errors';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';

const PAGE_SIZE = 20;

function displayDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('id-ID') : '-';
}

function metadataField(metadata: AuditLog['metadata'], key: string): string {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return '-';
  const value = metadata[key];
  return value === null || value === undefined ? '-' : String(value);
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({ targetId: '', userId: '' });
  const [appliedFilters, setAppliedFilters] = useState<{ targetId?: number; userId?: number }>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AuditLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    auditLogsApi.list({ page, pageSize: PAGE_SIZE, ...appliedFilters })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(toApiError(cause).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, appliedFilters, reload]);

  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    auditLogsApi.getById(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((cause: unknown) => {
        if (active) setDetailError(toApiError(cause).message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({
      ...(filters.targetId ? { targetId: Number(filters.targetId) } : {}),
      ...(filters.userId ? { userId: Number(filters.userId) } : {}),
    });
    setPage(1);
  }

  function clearFilters() {
    setFilters({ targetId: '', userId: '' });
    setAppliedFilters({});
    setPage(1);
  }

  const pagination = result?.pagination;
  const totalPages = Math.max(pagination?.totalPages ?? 0, 1);

  return (
    <div className="container page audit-page">
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p className="muted">Riwayat aktivitas sistem. Catatan audit tidak dapat diubah atau dihapus.</p>
        </div>
      </div>

      <form className="card audit-filters" onSubmit={applyFilters}>
        <label>
          Target ID
          <input
            type="number"
            min="1"
            step="1"
            value={filters.targetId}
            onChange={(event) => setFilters((current) => ({ ...current, targetId: event.target.value }))}
            placeholder="Semua target"
          />
        </label>
        <label>
          User ID
          <input
            type="number"
            min="1"
            step="1"
            value={filters.userId}
            onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
            placeholder="Semua pengguna"
          />
        </label>
        <div className="audit-filter-actions">
          <button className="btn btn-primary" type="submit">Terapkan filter</button>
          <button className="btn" type="button" onClick={clearFilters}>Hapus filter</button>
        </div>
      </form>

      {error && <ErrorState message={error} onRetry={() => setReload((current) => current + 1)} />}
      {loading && <Loading text="Memuat audit log..." />}
      {!loading && !error && result && result.items.length === 0 && (
        <EmptyState title="Belum ada catatan audit" hint="Coba ubah atau hapus filter yang digunakan." />
      )}
      {!loading && !error && result && result.items.length > 0 && (
        <>
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Pengguna</th>
                  <th>Target</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id}>
                    <td>{displayDate(item.createdAt)}</td>
                    <td><span className="tag tag-accent">{item.action}</span></td>
                    <td>
                      <strong>{item.userName}</strong>
                      <span className="audit-secondary">{item.userEmail} (ID {item.userId})</span>
                    </td>
                    <td>{item.targetTable} <span className="muted">#{item.targetId}</span></td>
                    <td>
                      <button className="btn" type="button" onClick={() => setSelectedId(item.id)}>
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination" aria-label="Navigasi halaman audit">
            <button
              className="btn"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Sebelumnya
            </button>
            <span>
              Halaman {pagination?.page ?? page} dari {totalPages}
              {' · '}
              {pagination?.total ?? 0} catatan
            </span>
            <button
              className="btn"
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Berikutnya
            </button>
          </div>
        </>
      )}

      {selectedId !== null && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          <section className="dialog audit-dialog" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
            <div className="page-head">
              <h2 id="audit-detail-title">Detail audit #{selectedId}</h2>
              <button className="btn" type="button" onClick={() => setSelectedId(null)}>Tutup</button>
            </div>
            {detailLoading && <Loading text="Memuat detail audit..." />}
            {detailError && <ErrorState message={detailError} />}
            {detail && (
              <>
                <dl className="kv audit-detail">
                  <dt>Aksi</dt><dd>{detail.action}</dd>
                  <dt>Pengguna</dt><dd>{detail.userName} ({detail.userEmail}) · ID {detail.userId}</dd>
                  <dt>Target</dt><dd>{detail.targetTable} #{detail.targetId}</dd>
                  <dt>Waktu</dt><dd>{displayDate(detail.createdAt)}</dd>
                  <dt>IP address</dt><dd>{metadataField(detail.metadata, 'ip_address')}</dd>
                  <dt>User agent</dt><dd className="audit-user-agent">{metadataField(detail.metadata, 'user_agent')}</dd>
                </dl>
                <h3>Metadata</h3>
                <pre className="audit-metadata">
                  {typeof detail.metadata === 'string'
                    ? detail.metadata
                    : JSON.stringify(detail.metadata, null, 2) ?? 'Tidak ada metadata'}
                </pre>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
