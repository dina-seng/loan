import { CheckIcon, AlertCircleIcon, RefreshCwIcon } from './Icons';

export default function SyncIndicator({ status, onRefresh, onRetry }) {
  const indicators = {
    idle: null,
    syncing: (
      <span className="flex items-center gap-1.5 text-xs text-primary-100 font-bold">
        <span className="animate-spin h-3.5 w-3.5 border-2 border-primary-200 border-t-white rounded-full"></span>
        <span className="hidden sm:inline">កំពុងធ្វើសមកាលកម្ម...</span>
      </span>
    ),
    synced: (
      <span className="flex items-center gap-1 text-xs text-green-300 font-bold">
        <CheckIcon className="w-4 h-4 text-green-300" />
        <span className="hidden sm:inline">ធ្វើសមកាលកម្មរួច</span>
      </span>
    ),
    failed: (
      <button
        onClick={onRetry}
        className="flex items-center gap-1 text-xs text-red-300 hover:text-red-100 justify-center font-bold"
        style={{ minHeight: '44px', minWidth: '44px' }}
      >
        <AlertCircleIcon className="w-4 h-4 text-red-300" />
        <span className="hidden sm:inline">បរាជ័យ!</span>
      </button>
    ),
  };

  return (
    <div className="flex items-center gap-1.5">
      {indicators[status]}
      <button
        onClick={onRefresh}
        className="flex items-center justify-center rounded-2xl
                   hover:bg-primary-700 active:bg-primary-800 transition-colors text-white"
        style={{ minHeight: '44px', minWidth: '44px' }}
        title="ផ្ទុកឡើងវិញ"
        aria-label="ផ្ទុកឡើងវិញ"
      >
        <RefreshCwIcon className="w-5 h-5" />
      </button>
    </div>
  );
}
