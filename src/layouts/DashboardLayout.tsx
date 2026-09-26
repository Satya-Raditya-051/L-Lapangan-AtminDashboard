import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, List, Users, LogOut, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  // State baru untuk menyimpan profil admin
  const [adminName, setAdminName] = useState('Admin User');
  const [adminRole, setAdminRole] = useState('ADMIN');

  // FUNGSI UNTUK MENGAMBIL INISIAL NAMA
  const getInitials = (name: string) => {
    if (!name) return 'A'; // Default kalau kosong
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      // Ambil huruf pertama dari kata pertama dan kata terakhir
      return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
    }
    // Kalau cuma 1 kata, ambil 2 huruf pertamanya
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const checkUserAndFetchProfile = async () => {
      // 1. Cek sesi login
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
      } else {
        // 2. Jika sudah login, ambil nama dari tabel petugas berdasarkan ID session
        const { data: profile, error } = await supabase
          .from('petugas')
          .select('nama_petugas, role')
          .eq('id', session.user.id)
          .single(); // Ambil 1 baris saja

        if (!error && profile) {
          setAdminName(profile.nama_petugas || 'Admin User');
          setAdminRole(profile.role?.toUpperCase() || 'ADMIN');
        }
        
        setIsLoading(false);
      }
    };

    checkUserAndFetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (isLoading) return <div className="h-screen bg-[#F8F9FA] flex items-center justify-center">Memuat Dashboard...</div>;

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/pekerjaan', label: 'Pekerjaan', icon: List },
    { path: '/petugas', label: 'Petugas', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col justify-between">
        <div>
          <div className="h-20 flex items-center px-6 gap-3">
            <div className="w-8 h-8 bg-[#06a0e5] rounded-lg flex items-center justify-center text-white">
              <Briefcase size={18} />
            </div>
            <h1 className="font-bold text-gray-900 text-xl tracking-tight">Admin Panel</h1>
          </div>

          {/* PROFIL YANG SUDAH DINAMIS */}
          <div className="flex flex-col items-center mt-4 mb-8 px-6 text-center">
            {/* Avatar Inisial */}
            <div className="w-20 h-20 rounded-full border-4 border-gray-50 mb-3 bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-bold shadow-sm">
              {getInitials(adminName)}
            </div>
            
            {/* Nama dan Role */}
            <h2 className="font-semibold text-gray-800 text-sm w-full truncate px-2" title={adminName}>
              {adminName}
            </h2>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full mt-1">
              {adminRole}
            </span>
          </div>

          <nav className="px-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.includes(item.path);
              return (
                <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive ? 'bg-[#06a0e5] text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 mb-4">
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-white bg-red-500 hover:bg-red-600 transition-colors font-medium text-sm cursor-pointer">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}