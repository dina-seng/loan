import { Link } from 'react-router-dom';
import { labels } from '../strings.km.js';
import { PageHeader } from '../components/Ui.jsx';
import { BanknoteIcon, CalendarIcon, PackageIcon } from '../components/Icons.jsx';
import { ScaleIcon } from '../components/NavIcons.jsx';

const tools = [
  { to: '/products', label: labels.products, Icon: PackageIcon },
  { to: '/deliveries', label: labels.deliveries, Icon: PackageIcon },
  { to: '/settlements', label: labels.settlements, Icon: ScaleIcon },
  { to: '/closings', label: labels.closings, Icon: CalendarIcon },
  { to: '/statements', label: labels.statements, Icon: BanknoteIcon },
  { to: '/audit', label: labels.audit, Icon: ScaleIcon },
];

export default function ToolsPage() {
  return (
    <>
      <PageHeader title={labels.tools} />
      <div className="grid grid-cols-2 gap-2">
        {tools.map(({ to, label, Icon }) => (
          <Link key={to} to={to} className="card flex min-h-[72px] flex-col justify-center gap-1 p-3 text-sm font-extrabold text-slate-800">
            <Icon className="h-5 w-5 text-brand-700" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
