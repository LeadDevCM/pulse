interface TableProps {
  headers: string[];
  children: React.ReactNode;
}

export default function Table({ headers, children }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg-alt border-b border-border">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-text-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}
