export default function SyncIndicator({ status, onRefresh, onRetry }) {
  const indicators = {
    idle: null,
    syncing: (
      <span className="flex items-center gap-1 text-xs text-primary-100">
        <span className="animate-spin h-3 w-3 border-2 border-primary-200 border-t-white rounded-full"></span>
        <span className="hidden sm:inline">កំពុងធ្វើសមកាលកម្ម...</span>
      </span>
    ),
    synced: (
      <span className="flex items-center gap-1 text-xs text-green-300">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span className="hidden sm:inline">ធ្វើសមកាលកម្មរួច</span>
      </span>
    ),
    failed: (
      <button
        onClick={onRetry}
        className="flex items-center gap-1 text-xs text-red-300 hover:text-red-100 justify-center"
        style={{ minHeight: '44px', minWidth: '44px' }}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <span className="hidden sm:inline">បរាជ័យ!</span>
      </button>
    ),
  };

  return (
    <div className="flex items-center gap-2">
      {indicators[status]}
      <button
        onClick={onRefresh}
        className="flex items-center justify-center rounded-lg
                   hover:bg-primary-700 active:bg-primary-800 transition-colors"
        style={{ minHeight: '44px', minWidth: '44px' }}
        title="ផ្ទុកឡើងវិញ (Refresh)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
