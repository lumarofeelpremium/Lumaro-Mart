import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Mic, 
  FolderLock, 
  Camera, 
  MapPin, 
  Bell, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Sparkles,
  RefreshCw,
  Smartphone
} from 'lucide-react';
import { 
  APP_PERMISSIONS, 
  AppPermissionKey, 
  checkAppPermission, 
  requestAppPermission, 
  openDeviceAppSettings,
  isAndroidNativeApp 
} from '../lib/permissions-utils';

export const AndroidPermissionsCard: React.FC = () => {
  const [permissionStates, setPermissionStates] = useState<Record<AppPermissionKey, boolean>>({
    notification: false,
    microphone: false,
    storage: true,
    camera: false,
    location: false,
    bluetooth: false,
  });

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const isNative = isAndroidNativeApp();

  const refreshPermissions = async () => {
    setIsRefreshing(true);
    const newStates: Record<AppPermissionKey, boolean> = { ...permissionStates };
    
    for (const item of APP_PERMISSIONS) {
      newStates[item.id] = await checkAppPermission(item.id);
    }
    
    setPermissionStates(newStates);
    setIsRefreshing(false);
  };

  useEffect(() => {
    refreshPermissions();
  }, []);

  const handleRequestSingle = async (key: AppPermissionKey) => {
    setLoadingKey(key);
    try {
      await requestAppPermission(key);
      // Wait briefly for OS prompt response
      setTimeout(async () => {
        const granted = await checkAppPermission(key);
        setPermissionStates(prev => ({ ...prev, [key]: granted }));
        setLoadingKey(null);
        if (granted) {
          setStatusFeedback(`✅ ${key.toUpperCase()} permission safaltapoorvak allow ho gayi!`);
        } else {
          setStatusFeedback(`ℹ️ ${key.toUpperCase()} permission allow nahi hui. Phone Settings se enable karein.`);
        }
        setTimeout(() => setStatusFeedback(null), 4000);
      }, 1000);
    } catch {
      setLoadingKey(null);
    }
  };

  const handleRequestAll = async () => {
    setLoadingKey('all');
    try {
      await requestAppPermission('all');
      setTimeout(async () => {
        await refreshPermissions();
        setLoadingKey(null);
        setStatusFeedback('🎉 Sabhi zaroori permissions ke liye OS request bhej di gayi hai!');
        setTimeout(() => setStatusFeedback(null), 4000);
      }, 1200);
    } catch {
      setLoadingKey(null);
    }
  };

  const getPermissionIcon = (id: AppPermissionKey) => {
    switch (id) {
      case 'microphone': return <Mic className="w-5 h-5 text-purple-600" />;
      case 'storage': return <FolderLock className="w-5 h-5 text-blue-600" />;
      case 'camera': return <Camera className="w-5 h-5 text-rose-600" />;
      case 'location': return <MapPin className="w-5 h-5 text-emerald-600" />;
      case 'notification': return <Bell className="w-5 h-5 text-amber-600" />;
      case 'bluetooth': return <Printer className="w-5 h-5 text-cyan-600" />;
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-[#66D2A4] text-white flex items-center justify-center font-bold shadow-xs">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-gray-900">
                Android App Permissions Manager
              </h3>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isNative 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
              }`}>
                <Smartphone size={11} />
                {isNative ? 'Android Native App' : 'Web / Chrome Mode'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Microphone, Storage, Camera, GPS Location, Notifications & Thermal Printer Permissions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshPermissions}
            disabled={isRefreshing}
            className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {statusFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2">
          <Sparkles size={16} className="text-emerald-600 shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Permissions List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {APP_PERMISSIONS.map((perm) => {
          const isGranted = permissionStates[perm.id];
          const isLoading = loadingKey === perm.id;

          return (
            <div 
              key={perm.id}
              className="p-3.5 bg-gray-50/70 hover:bg-emerald-50/20 rounded-2xl border border-gray-200/70 hover:border-emerald-200 flex flex-col justify-between gap-3 transition-all"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white rounded-xl shadow-2xs">
                      {getPermissionIcon(perm.id)}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-gray-900 leading-tight">
                        {perm.title}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-medium">
                        {perm.hindiTitle}
                      </p>
                    </div>
                  </div>

                  {isGranted ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} />
                      Allowed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      <AlertCircle size={12} />
                      Required
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-600 leading-relaxed">
                  {perm.description}
                </p>
                <div className="text-[10px] font-semibold text-gray-400">
                  🎯 Kaam: {perm.requiredFor}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between gap-2">
                <span className="text-[10px] text-gray-500 font-mono">
                  {perm.id === 'storage' ? 'READ/WRITE_MEDIA' : perm.id.toUpperCase()}
                </span>

                <button
                  type="button"
                  onClick={() => handleRequestSingle(perm.id)}
                  disabled={isLoading}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                    isGranted
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  }`}
                >
                  {isLoading ? 'Wait...' : isGranted ? 'Re-check' : 'Allow Permission'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="space-y-0.5 text-center sm:text-left">
          <h4 className="text-xs font-black text-emerald-950 flex items-center justify-center sm:justify-start gap-1.5">
            <Sparkles size={14} className="text-emerald-600" />
            Android Marshmallow (6.0) se Android 14+ Full Compatibility
          </h4>
          <p className="text-[11px] text-emerald-800">
            Ek click me sabhi permissions activate karein ya device settings manage karein.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
          <button
            type="button"
            onClick={openDeviceAppSettings}
            className="py-2.5 px-3.5 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl border border-gray-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ExternalLink size={13} />
            <span>⚙️ Phone App Settings</span>
          </button>

          <button
            type="button"
            onClick={handleRequestAll}
            disabled={loadingKey === 'all'}
            className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck size={14} />
            <span>⚡ Sabhi Permissions Allow Karein</span>
          </button>
        </div>
      </div>
    </div>
  );
};
