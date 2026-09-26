import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Briefcase, CheckCircle, Clock, AlertCircle, Activity, MapPin, Users, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- DEFINISI TIPE DATA ---
interface Task {
  id: string;
  judul_pekerjaan: string;
  lokasi: string;
  status_terkini: string | null;
  created_at: string;
  petugas: { nama_petugas: string } | null;
}

interface ActivityLog {
  id: string;
  status_progress: string;
  created_at: string;
  nama_petugas: string | null;
  pekerjaan: { judul_pekerjaan: string } | null;
}

interface TechStatus {
  id: string;
  name: string;
  status: 'Sibuk' | 'Standby';
  currentTask: string | null;
}

interface TechTask {
  judul_pekerjaan: string;
  status_terkini: string | null;
}

interface TechData {
  id: string;
  nama_petugas: string | null;
  pekerjaan: TechTask[] | null;
}

interface ChartData {
  name: string;
  dateStr: string;
  Masuk: number;
  Selesai: number;
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rawTasks, setRawTasks] = useState<Task[]>([]); // Menyimpan seluruh data untuk kalkulasi grafik
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [technicians, setTechnicians] = useState<TechStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- STATE FILTER GRAFIK ---
  const [chartRange, setChartRange] = useState<'7' | '30' | 'custom'>('7');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [stats, setStats] = useState({
    total: 0,
    selesai: 0,
    progress: 0,
    belum: 0
  });

  // 1. FUNGSI AMBIL DATA UTAMA (Berjalan 1x saat load)
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: tasksData } = await supabase
          .from('pekerjaan')
          .select(`id, judul_pekerjaan, lokasi, status_terkini, created_at, petugas ( nama_petugas )`)
          .order('created_at', { ascending: false });

        if (tasksData) {
          const typedTasks = tasksData as unknown as Task[];
          setTasks(typedTasks.slice(0, 5));
          setRawTasks(typedTasks); // Simpan semua data mentah untuk chart

          // Hitung Statistik
          let selesai = 0, progress = 0, belum = 0;
          typedTasks.forEach((task) => {
            const status = (task.status_terkini || '').toLowerCase().trim();
            if (!status || status === 'null' || status === 'pending') belum++;
            else if (status.includes('selesai')) selesai++;
            else progress++;
          });
          setStats({ total: typedTasks.length, selesai, progress, belum });
        }

        const { data: activityData } = await supabase
          .from('progres_pekerjaan')
          .select(`id, status_progress, created_at, nama_petugas, pekerjaan ( judul_pekerjaan )`)
          .order('created_at', { ascending: false })
          .limit(6);

        if (activityData) setActivities(activityData as unknown as ActivityLog[]);

        const { data: techData } = await supabase
          .from('petugas')
          .select(`id, nama_petugas, pekerjaan ( judul_pekerjaan, status_terkini )`)
          .eq('is_active', true)
          .eq('role', 'teknisi');

        if (techData) {
          const mappedTechs = (techData as TechData[]).map((tech) => {
            const activeTask = tech.pekerjaan?.find((p) => {
              const s = (p.status_terkini || '').toLowerCase().trim();
              return s && s !== 'null' && s !== 'pending' && !s.includes('selesai');
            });

            return {
              id: tech.id,
              name: tech.nama_petugas || 'Tanpa Nama',
              status: activeTask ? 'Sibuk' : 'Standby',
              currentTask: activeTask ? activeTask.judul_pekerjaan : null
            } as TechStatus;
          });
          
          mappedTechs.sort((a, b) => (a.status === b.status ? 0 : a.status === 'Standby' ? -1 : 1));
          setTechnicians(mappedTechs);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // 2. FUNGSI KALKULASI GRAFIK (Berjalan jika data mentah atau range tanggal berubah)
  const chartData = useMemo(() => {
    if (rawTasks.length === 0 && !isLoading) return [];

    let start = new Date();
    const end = new Date();

    if (chartRange === '7') {
      start.setDate(end.getDate() - 6);
    } else if (chartRange === '30') {
      start.setDate(end.getDate() - 29);
    } else if (chartRange === 'custom') {
      if (startDate && endDate) {
        start = new Date(startDate);
        // Set end ke tanggal kustom (ditambah 23:59 agar mencakup waktu akhir hari)
        const customEnd = new Date(endDate);
        end.setTime(customEnd.getTime());
      } else {
        return []; // Jangan render jika tanggal custom belum lengkap
      }
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Buat deret array tanggal kosong dari start sampai end
    const dateRangeArray: ChartData[] = [];
    const current = new Date(start);

    // Mencegah loop terlalu banyak (maksimal 90 hari) jika user iseng pilih custom
    let loopCount = 0;
    while (current <= end && loopCount < 90) {
      // Ambil format YYYY-MM-DD menggunakan timezone lokal agar akurat
      const localDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      
      dateRangeArray.push({
        dateStr: localDateStr,
        name: current.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }), // Cth: "10 Sep"
        Masuk: 0,
        Selesai: 0
      });
      current.setDate(current.getDate() + 1);
      loopCount++;
    }

    // Isi datanya dari rawTasks
    rawTasks.forEach((task) => {
      // Konversi UTC database ke timezone lokal agar tepat jatuh di harinya
      const taskDateObj = new Date(task.created_at);
      const localTaskDateStr = `${taskDateObj.getFullYear()}-${String(taskDateObj.getMonth() + 1).padStart(2, '0')}-${String(taskDateObj.getDate()).padStart(2, '0')}`;
      
      const dayIndex = dateRangeArray.findIndex(d => d.dateStr === localTaskDateStr);
      
      if (dayIndex !== -1) {
        dateRangeArray[dayIndex].Masuk += 1;
        const status = (task.status_terkini || '').toLowerCase().trim();
        if (status.includes('selesai')) {
          dateRangeArray[dayIndex].Selesai += 1;
        }
      }
    });

    return dateRangeArray;
  }, [rawTasks, chartRange, startDate, endDate, isLoading]);

  // --- HELPER UI ---
  const getStatusBadge = (status: string | null) => {
    const s = (status || '').toLowerCase().trim();
    if (!s || s === 'null' || s === 'pending') return <span className="bg-red-100 text-red-700 px-3 py-1 text-xs font-semibold rounded-full w-max">Belum Diambil</span>;
    if (s.includes('selesai')) return <span className="bg-green-100 text-green-700 px-3 py-1 text-xs font-semibold rounded-full w-max">{status}</span>;
    return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 text-xs font-semibold rounded-full w-max">{status}</span>;
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'Baru saja';
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} jam yang lalu`;
    return past.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-6">
      
      {/* 1. KARTU STATISTIK */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-[#06a0e5]/10 text-[#06a0e5] rounded-xl flex items-center justify-center shrink-0">
            <Briefcase size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Total Pekerjaan</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">On Progress</p>
            <p className="text-2xl font-bold text-gray-900">{stats.progress}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Selesai</p>
            <p className="text-2xl font-bold text-gray-900">{stats.selesai}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium">Belum Diambil</p>
            <p className="text-2xl font-bold text-gray-900">{stats.belum}</p>
          </div>
        </div>
      </div>

      {/* 2. GRAFIK KINERJA DENGAN KONTROL RENTANG WAKTU */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-[#06a0e5]" size={20} />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Grafik Kinerja Lapangan</h3>
              <p className="text-sm text-gray-500">Perbandingan tugas baru dan tugas selesai.</p>
            </div>
          </div>

          {/* KONTROL FILTER TANGGAL */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <select 
              value={chartRange} 
              onChange={(e) => setChartRange(e.target.value as '7' | '30' | 'custom')}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#06a0e5] outline-none bg-white w-full sm:w-auto"
            >
              <option value="7">7 Hari Terakhir</option>
              <option value="30">30 Hari Terakhir</option>
              <option value="custom">Pilih Tanggal</option>
            </select>
            
            {chartRange === 'custom' && (
              <div className="flex items-center gap-2 w-full sm:w-auto bg-gray-50 p-1 rounded-xl border border-gray-200">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="px-2 py-1 text-xs bg-transparent outline-none w-full"
                />
                <span className="text-gray-400 font-bold">-</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="px-2 py-1 text-xs bg-transparent outline-none w-full"
                />
              </div>
            )}
          </div>
        </div>
        
        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-gray-500 text-sm">Memuat grafik...</div>
        ) : chartData.length === 0 && chartRange === 'custom' ? (
          <div className="h-72 flex items-center justify-center text-gray-400 text-sm bg-gray-50/50 rounded-xl border border-dashed border-gray-200">Silakan pilih tanggal awal dan akhir.</div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMasuk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06a0e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06a0e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSelesai" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="Masuk" stroke="#06a0e5" strokeWidth={3} fillOpacity={1} fill="url(#colorMasuk)" />
                <Area type="monotone" dataKey="Selesai" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorSelesai)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 3. AREA BAWAH: TABEL & ACTIVITY FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL KIRI: DAFTAR PEKERJAAN */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">Pekerjaan Terbaru</h3>
            <Link to="/pekerjaan" className="text-sm font-medium text-[#06a0e5] hover:text-[#007cb5] transition-colors">
              Lihat Semua &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Tugas</th>
                  <th className="px-6 py-4 font-semibold">Petugas</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Memuat data...</td></tr>
                ) : tasks.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Belum ada tugas lapangan.</td></tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{task.judul_pekerjaan}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 truncate max-w-50">
                          <MapPin size={12} /> {task.lokasi}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{task.petugas?.nama_petugas || '-'}</td>
                      <td className="px-6 py-4">{getStatusBadge(task.status_terkini)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL KANAN: LIVE ACTIVITY FEED */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full min-h-100">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="text-[#06a0e5]" size={20} />
            <h3 className="text-lg font-bold text-gray-900">Aktivitas Terkini</h3>
          </div>

          <div className="flex-1 overflow-y-auto pr-2">
            {isLoading ? (
              <p className="text-center text-sm text-gray-500 mt-10">Memuat log...</p>
            ) : activities.length === 0 ? (
              <p className="text-center text-sm text-gray-500 mt-10">Belum ada pergerakan dari lapangan.</p>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-[#06a0e5]/20 before:to-transparent">
                {activities.map((act) => (
                  <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-[#06a0e5] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 relative left-0 md:left-auto"></div>
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] bg-gray-50 p-3 rounded-xl border border-gray-100 hover:border-[#06a0e5]/30 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-900 text-sm truncate pr-2">{act.nama_petugas || 'Sistem'}</span>
                        <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap bg-white px-2 py-0.5 rounded-full border border-gray-100">
                          {getTimeAgo(act.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-snug">
                        <span className="font-semibold text-[#06a0e5]">{act.status_progress}</span> pada 
                        <br/>"{act.pekerjaan?.judul_pekerjaan || 'Tugas Dihapus'}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. AREA BAWAH: KETERSEDIAAN TEKNISI */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="text-[#06a0e5]" size={20} />
          <div>
            <h3 className="text-lg font-bold text-gray-900">Monitor Ketersediaan Teknisi</h3>
            <p className="text-sm text-gray-500">Pantau siapa yang sedang bertugas dan siapa yang siap menerima tugas.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-sm text-gray-500 py-6">Memuat status teknisi...</p>
        ) : technicians.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-6">Belum ada akun teknisi yang aktif.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {technicians.map((tech) => (
              <div 
                key={tech.id} 
                className={`p-4 rounded-xl border ${
                  tech.status === 'Standby' 
                    ? 'bg-green-50/50 border-green-100 hover:border-green-200' 
                    : 'bg-red-50/50 border-red-100 hover:border-red-200'
                } transition-colors flex flex-col`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-900 text-sm truncate pr-2">{tech.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    tech.status === 'Standby' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {tech.status}
                  </span>
                </div>
                
                {tech.status === 'Sibuk' ? (
                  <p className="text-xs text-gray-600 mt-auto flex items-start gap-1">
                    <Briefcase size={12} className="shrink-0 mt-0.5 text-red-400" />
                    <span className="line-clamp-2" title={tech.currentTask!}>Mengerjakan: {tech.currentTask}</span>
                  </p>
                ) : (
                  <p className="text-xs text-green-600 mt-auto flex items-center gap-1 font-medium">
                    <CheckCircle size={12} />
                    Siap menerima tugas
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}