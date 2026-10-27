export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="skeleton h-8 w-40 mb-2" />
        <div className="skeleton h-4 w-56" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="skeleton h-7 w-28 mb-1" />
            <div className="skeleton h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-0">
            <div className="px-5 py-4 border-b border-stone-100">
              <div className="skeleton h-5 w-36" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center gap-3 border-b border-stone-50">
                <div className="skeleton w-9 h-9 rounded-lg" />
                <div className="flex-1">
                  <div className="skeleton h-4 w-32 mb-1.5" />
                  <div className="skeleton h-3 w-20" />
                </div>
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="card p-5">
            <div className="skeleton h-5 w-36 mb-4" />
            <div className="skeleton h-36 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
