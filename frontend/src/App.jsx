import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import gsap from 'gsap';
import { 
  Shield, Search, UserPlus, History, User, Folder, Calendar, 
  Edit3, Trash2, Globe, Activity, FileText, AlertTriangle, 
  X, CheckCircle, Fingerprint, Lock, RefreshCw, ChevronRight
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function App() {
  // Navigation & Role State
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, enroll, search, audit
  const [userRole, setUserRole] = useState('booking_officer'); // booking_officer, admin
  const [userId, setUserId] = useState('officer_smith_45');
  
  // Dashboard & Global State
  const [criminals, setCriminals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ totalProfiles: 0, totalCases: 0, systemQueries: 0 });

  // Enrollment Form State
  const [enrollForm, setEnrollForm] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'Male',
    nationality: 'United States',
    distinguishing_marks: '',
    charge_category: 'Theft',
    charge_details: '',
    modus_operandi: '',
    reason: 'New arrest booking intake'
  });
  const [enrollImage, setEnrollImage] = useState(null);
  const [enrollImagePreview, setEnrollImagePreview] = useState(null);
  const [enrollStatus, setEnrollStatus] = useState({ type: '', message: '' });

  // Identification State
  const [searchImage, setSearchImage] = useState(null);
  const [searchImagePreview, setSearchImagePreview] = useState(null);
  const [tolerance, setTolerance] = useState(0.6);
  const [searchReason, setSearchReason] = useState('Suspect face match lookup');
  const [searchResult, setSearchResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [searchStatus, setSearchStatus] = useState({ type: '', message: '' });

  // Administrative Modals
  const [editingCriminal, setEditingCriminal] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    gender: '',
    nationality: '',
    distinguishing_marks: '',
    reason: 'Correcting profile documentation error'
  });
  const [expungingId, setExpungingId] = useState(null);
  const [expungeReason, setExpungeReason] = useState('Administrative record expungement');

  // GSAP Scanner Animation Reference
  const scannerLineRef = useRef(null);
  const scannerTimeline = useRef(null);

  // Fetch Data on Load & Tab Changes
  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Criminals
      const criminalsRes = await axios.get(`${API_BASE}/api/v1/criminals?user_id=${userId}`);
      setCriminals(criminalsRes.data);

      // Fetch Audit Logs if Admin
      let logsCount = 0;
      if (userRole === 'admin') {
        const logsRes = await axios.get(`${API_BASE}/api/v1/audit-logs?user_role=admin`);
        setAuditLogs(logsRes.data);
        logsCount = logsRes.data.length;
      } else {
        logsCount = criminalsRes.data.length * 3 + 12; // Static representation for non-admins
      }

      // Compute statistics
      const totalCasesCount = criminalsRes.data.reduce((acc, curr) => acc + curr.case_count, 0);
      setStats({
        totalProfiles: criminalsRes.data.length,
        totalCases: totalCasesCount,
        systemQueries: logsCount
      });
      
    } catch (error) {
      console.error('Error fetching system data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userRole, activeTab]);

  // Handle Role Switcher changes
  const handleRoleChange = (role) => {
    setUserRole(role);
    setUserId(role === 'admin' ? 'investigator_jones_01' : 'officer_smith_45');
    if (role !== 'admin' && activeTab === 'audit') {
      setActiveTab('dashboard');
    }
  };

  // GSAP Animation for Face Scanner
  useEffect(() => {
    if (isScanning && scannerLineRef.current) {
      // Start looping laser sweep
      scannerTimeline.current = gsap.timeline({ repeat: -1 });
      scannerTimeline.current.fromTo(
        scannerLineRef.current,
        { top: '0%' },
        { top: '100%', duration: 1.8, ease: 'power1.inOut' }
      ).to(
        scannerLineRef.current,
        { top: '0%', duration: 1.8, ease: 'power1.inOut' }
      );
    } else {
      if (scannerTimeline.current) {
        scannerTimeline.current.kill();
        scannerTimeline.current = null;
      }
    }
  }, [isScanning]);

  // Handle file changes
  const handleEnrollImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEnrollImage(file);
      setEnrollImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSearchImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSearchImage(file);
      setSearchImagePreview(URL.createObjectURL(file));
      setSearchResult(null);
      setSearchStatus({ type: '', message: '' });
    }
  };

  // Submit Enrollment
  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!enrollImage) {
      setEnrollStatus({ type: 'error', message: 'Please select or upload a frontal mugshot photograph.' });
      return;
    }

    const formData = new FormData();
    formData.append('first_name', enrollForm.first_name);
    formData.append('last_name', enrollForm.last_name);
    formData.append('dob', enrollForm.dob);
    formData.append('gender', enrollForm.gender);
    formData.append('nationality', enrollForm.nationality);
    formData.append('distinguishing_marks', enrollForm.distinguishing_marks);
    formData.append('charge_category', enrollForm.charge_category);
    formData.append('charge_details', enrollForm.charge_details);
    formData.append('modus_operandi', enrollForm.modus_operandi);
    formData.append('user_id', userId);
    formData.append('reason', enrollForm.reason);
    formData.append('image', enrollImage);

    try {
      setLoading(true);
      setEnrollStatus({ type: 'info', message: 'Detecting face structure and extracting embedding...' });
      
      const response = await axios.post(`${API_BASE}/api/v1/criminals/enroll`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setEnrollStatus({ 
          type: 'success', 
          message: `Profile Enrolled Successfully! System UID: ${response.data.system_uid}` 
        });
        // Reset Form
        setEnrollForm({
          first_name: '',
          last_name: '',
          dob: '',
          gender: 'Male',
          nationality: 'United States',
          distinguishing_marks: '',
          charge_category: 'Theft',
          charge_details: '',
          modus_operandi: '',
          reason: 'New arrest booking intake'
        });
        setEnrollImage(null);
        setEnrollImagePreview(null);
        fetchData();
      }
    } catch (err) {
      setEnrollStatus({ 
        type: 'error', 
        message: err.response?.data?.detail || 'An error occurred during facial enrollment.' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Run Suspect Facial Match Lookup
  const handleIdentifySearch = async () => {
    if (!searchImage) {
      setSearchStatus({ type: 'error', message: 'Please upload a suspect photo to scan.' });
      return;
    }

    const formData = new FormData();
    formData.append('image', searchImage);
    formData.append('tolerance', tolerance);
    formData.append('user_id', userId);
    formData.append('reason', searchReason);

    try {
      setSearchResult(null);
      setSearchStatus({ type: '', message: '' });
      setIsScanning(true);

      const response = await axios.post(`${API_BASE}/api/v1/criminals/identify`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Brief delay to showcase GSAP scanning bar
      setTimeout(() => {
        setIsScanning(false);
        setSearchResult(response.data);
        if (!response.data.match_found) {
          setSearchStatus({ 
            type: 'warning', 
            message: 'Search Completed: No matching face found exceeding the similarity threshold.' 
          });
        }
      }, 1500);

    } catch (err) {
      setIsScanning(false);
      setSearchStatus({ 
        type: 'error', 
        message: err.response?.data?.detail || 'An error occurred during biometric search.' 
      });
    }
  };

  // Open administrative edit modal
  const openEditModal = (criminal) => {
    setEditingCriminal(criminal);
    setEditForm({
      first_name: criminal.first_name,
      last_name: criminal.last_name,
      gender: criminal.gender || 'Male',
      nationality: criminal.nationality || 'United States',
      distinguishing_marks: criminal.distinguishing_marks || '',
      reason: 'Administrative correction of biometric profile details'
    });
  };

  // Submit Administrative Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('first_name', editForm.first_name);
    formData.append('last_name', editForm.last_name);
    formData.append('gender', editForm.gender);
    formData.append('nationality', editForm.nationality);
    formData.append('distinguishing_marks', editForm.distinguishing_marks);
    formData.append('user_role', userRole);
    formData.append('user_id', userId);
    formData.append('reason', editForm.reason);

    try {
      setLoading(true);
      await axios.put(`${API_BASE}/api/v1/criminals/${editingCriminal.id}`, formData);
      setEditingCriminal(null);
      fetchData();
      
      // Update result view if open
      if (searchResult && searchResult.criminal_profile) {
        handleIdentifySearch();
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to modify record.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Expungement
  const handleExpungeSubmit = async () => {
    const formData = new FormData();
    formData.append('user_role', userRole);
    formData.append('user_id', userId);
    formData.append('reason', expungeReason);

    try {
      setLoading(true);
      await axios.delete(`${API_BASE}/api/v1/criminals/${expungingId}`, { data: formData });
      setExpungingId(null);
      setSearchResult(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to expunge record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 antialiased font-sans">
      
      {/* HEADER SECTION */}
      <header className="bg-slate-900 text-white shadow-md px-6 py-4 flex flex-col md:flex-row justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className="bg-blue-600 p-2.5 rounded-lg text-white shadow-inner flex justify-center items-center">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-outfit text-xl font-bold tracking-tight">CFRMS Intelligence</h1>
            <p className="text-xs text-slate-400 font-mono">Criminal Face Recognition & Record Management</p>
          </div>
        </div>

        {/* System Operator & Role Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-left">
              <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider">Active Session</span>
              <span className="block text-xs font-semibold text-slate-200">{userId}</span>
            </div>
          </div>

          <div className="bg-slate-800 p-1.5 rounded-lg border border-slate-700 flex gap-1.5">
            <button 
              onClick={() => handleRoleChange('booking_officer')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${userRole === 'booking_officer' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Booking Officer
            </button>
            <button 
              onClick={() => handleRoleChange('admin')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${userRole === 'admin' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Lock className="w-3.5 h-3.5" />
              Investigator / Admin
            </button>
          </div>
        </div>
      </header>

      {/* VIEW NAVIGATION & LAYOUT CONTAINER */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* SIDEBAR VIEW SELECTOR */}
        <aside className="w-full lg:w-64 bg-slate-900 border-r border-slate-800 px-4 py-6 text-white flex flex-col gap-1.5">
          <span className="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-widest font-mono mb-2">Navigation Panel</span>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-blue-600/90 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Activity className="w-4 h-4" />
            Dashboard Hub
          </button>

          <button 
            onClick={() => setActiveTab('enroll')}
            className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all ${activeTab === 'enroll' ? 'bg-blue-600/90 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <UserPlus className="w-4 h-4" />
            Enroll Mugshot
          </button>

          <button 
            onClick={() => setActiveTab('search')}
            className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all ${activeTab === 'search' ? 'bg-blue-600/90 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Fingerprint className="w-4 h-4" />
            Identity Search
          </button>

          {userRole === 'admin' && (
            <button 
              onClick={() => setActiveTab('audit')}
              className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 text-sm font-medium transition-all ${activeTab === 'audit' ? 'bg-blue-600/90 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <FileText className="w-4 h-4" />
              Immutable Audit Logs
            </button>
          )}

          {/* Quick Informational Card */}
          <div className="mt-auto bg-slate-950/80 rounded-xl p-4 border border-slate-800/80">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1">Vector DB Status</span>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-slate-300">pgvector Connected</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Matches execute 1:N HNSW indexing on 512-D vector representations.
            </p>
          </div>
        </aside>

        {/* MAIN DISPLAY PORT */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          
          {/* STATS OVERVIEW CARDS */}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">Enrolled Criminals</span>
                  <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.totalProfiles}</h3>
                </div>
                <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                  <User className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">Active Arrest Incidents</span>
                  <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.totalCases}</h3>
                </div>
                <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                  <Folder className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">Secure Audited Logs</span>
                  <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{stats.systemQueries}</h3>
                </div>
                <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
                  <Shield className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}

          {/* VIEW: DASHBOARD HUB */}
          {activeTab === 'dashboard' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Enrolled Criminal Records</h2>
                  <p className="text-xs text-slate-400">Chronological summary of criminal master records and active biometrics</p>
                </div>
                <button 
                  onClick={fetchData} 
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {loading && criminals.length === 0 ? (
                <div className="p-12 text-center text-slate-400">Loading system catalog...</div>
              ) : criminals.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  No profiles currently enrolled. Use the "Enroll Mugshot" module to add records.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 uppercase text-[11px] font-mono tracking-wider border-b border-slate-200">
                        <th className="py-4 px-6">Mugshot</th>
                        <th className="py-4 px-6">True Name</th>
                        <th className="py-4 px-6">DOB / Gender</th>
                        <th className="py-4 px-6">Nationality</th>
                        <th className="py-4 px-6">Recent Offense</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {criminals.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            {c.image_url ? (
                              <img 
                                src={`${API_BASE}${c.image_url}`} 
                                alt={c.first_name} 
                                className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-mono text-[10px]">NO PIC</div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-900">
                            {c.first_name} {c.last_name}
                            <span className="block text-[11px] text-slate-400 font-mono font-normal mt-0.5">{c.system_uid}</span>
                          </td>
                          <td className="py-4 px-6">
                            {c.dob}
                            <span className="block text-xs text-slate-400 font-normal mt-0.5">{c.gender}</span>
                          </td>
                          <td className="py-4 px-6">{c.nationality || 'N/A'}</td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                              {c.recent_charge}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-mono font-normal mt-0.5">{c.case_count} Case(s)</span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex justify-end gap-2">
                              {userRole === 'admin' && (
                                <>
                                  <button 
                                    onClick={() => openEditModal(c)}
                                    className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                                    title="Edit Profile"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setExpungingId(c.id)}
                                    className="p-2 border border-slate-200 rounded-lg text-rose-600 hover:bg-rose-50 hover:border-rose-200 active:scale-95 transition-all"
                                    title="Expunge Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={() => {
                                  // Mock scan/search for this image to view dossier
                                  setActiveTab('search');
                                  setSearchImagePreview(`${API_BASE}${c.image_url}`);
                                  // Setup mock search fetch
                                  setSearchStatus({ type: 'info', message: 'Visualizing profile dossier...' });
                                  axios.get(`${API_BASE}/api/v1/criminals?user_id=${userId}`).then(res => {
                                    // Make identity request
                                    // Use target URL to download image or trigger mock identification logic
                                  });
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all flex items-center gap-1"
                              >
                                View Dossier
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW: ENROLLMENT FORM */}
          {activeTab === 'enroll' && (
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Biometric Mugshot Enrollment</h2>
                <p className="text-xs text-slate-400">Enroll a newly apprehended individual and establish core vector biometric embeddings</p>
              </div>

              {enrollStatus.message && (
                <div className={`p-4 mx-6 mt-6 rounded-xl text-sm border flex items-center gap-2 ${
                  enrollStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                  enrollStatus.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                  'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                  {enrollStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  {enrollStatus.message}
                </div>
              )}

              <form onSubmit={handleEnrollSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Image Upload Zone */}
                <div className="flex flex-col gap-4">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Facial Mugshot Image</span>
                  
                  <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden bg-slate-50 group">
                    {enrollImagePreview ? (
                      <>
                        <img 
                          src={enrollImagePreview} 
                          alt="Enrollment Preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                          <span className="text-xs font-bold text-white bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700">Change Photo</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="bg-white p-4 rounded-full shadow-sm border border-slate-100 mb-3 text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                          <UserPlus className="w-8 h-8" />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 block">Drag & Drop Image here</span>
                        <span className="text-[10px] text-slate-400 block mt-1">Supports PNG, JPEG up to 10MB</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleEnrollImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-500 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-slate-700 mb-0.5">Automated Bio-Alignment</span>
                      The system parses eye positioning, normalizes lighting anomalies, and generates the vector encoding on upload.
                    </div>
                  </div>
                </div>

                {/* Metadata Fields */}
                <div className="flex flex-col gap-4">
                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Personal Information</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">First Name</label>
                      <input 
                        type="text" 
                        required
                        value={enrollForm.first_name}
                        onChange={(e) => setEnrollForm({...enrollForm, first_name: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name</label>
                      <input 
                        type="text" 
                        required
                        value={enrollForm.last_name}
                        onChange={(e) => setEnrollForm({...enrollForm, last_name: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
                      <input 
                        type="date" 
                        required
                        value={enrollForm.dob}
                        onChange={(e) => setEnrollForm({...enrollForm, dob: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                      <select 
                        value={enrollForm.gender}
                        onChange={(e) => setEnrollForm({...enrollForm, gender: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nationality</label>
                      <input 
                        type="text"
                        value={enrollForm.nationality}
                        onChange={(e) => setEnrollForm({...enrollForm, nationality: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                        placeholder="United States"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Alias / Distinguishing Marks</label>
                      <input 
                        type="text"
                        value={enrollForm.distinguishing_marks}
                        onChange={(e) => setEnrollForm({...enrollForm, distinguishing_marks: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                        placeholder="Alias: Johnny Fox, Scar on eyebrow"
                      />
                    </div>
                  </div>

                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono border-t border-slate-100 pt-3 mt-1">Apprehension details</span>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Charge Category</label>
                      <select 
                        value={enrollForm.charge_category}
                        onChange={(e) => setEnrollForm({...enrollForm, charge_category: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                      >
                        <option>Theft</option>
                        <option>Narcotics</option>
                        <option>Cybercrime</option>
                        <option>Assault</option>
                        <option>Felony</option>
                        <option>Misdemeanor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Modus Operandi (MO)</label>
                      <input 
                        type="text"
                        value={enrollForm.modus_operandi}
                        onChange={(e) => setEnrollForm({...enrollForm, modus_operandi: e.target.value})}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                        placeholder="Bypasses lock systems with signal jammer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Charge Specifics</label>
                    <textarea 
                      required
                      value={enrollForm.charge_details}
                      onChange={(e) => setEnrollForm({...enrollForm, charge_details: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50 h-16 resize-none"
                      placeholder="Enter specific details regarding arrest case..."
                    />
                  </div>

                  <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono border-t border-slate-100 pt-3 mt-1">Audit Trail documentation</span>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Enrollment</label>
                    <input 
                      type="text" 
                      required
                      value={enrollForm.reason}
                      onChange={(e) => setEnrollForm({...enrollForm, reason: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow mt-2 transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? 'Processing Biometrics...' : 'Enroll Suspect Record'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW: IDENTITY SEARCH CONSOLE */}
          {activeTab === 'search' && (
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
              
              {/* Search input card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h2 className="text-lg font-bold text-slate-900">Biometric Identity Search (1:N)</h2>
                  <p className="text-xs text-slate-400">Match an unidentified suspect photograph against the database profiles</p>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Dropzone with scanner sweep */}
                  <div className="flex flex-col gap-4">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Suspect Photograph</span>
                    
                    <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[250px] relative overflow-hidden bg-slate-50 group">
                      {searchImagePreview ? (
                        <>
                          <img 
                            src={searchImagePreview} 
                            alt="Suspect Preview" 
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          
                          {/* Glowing GSAP scan sweep line */}
                          {isScanning && (
                            <div 
                              ref={scannerLineRef}
                              className="absolute left-0 right-0 h-1.5 scan-line z-10"
                            />
                          )}

                          <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all z-20">
                            <span className="text-xs font-bold text-white bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700 font-sans">Upload Different Photo</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="bg-white p-4 rounded-full shadow-sm border border-slate-100 mb-3 text-slate-400 group-hover:text-blue-500 group-hover:scale-110 transition-all">
                            <Search className="w-8 h-8" />
                          </div>
                          <span className="text-xs font-semibold text-slate-600 block">Drag & Drop Suspect Photo</span>
                          <span className="text-[10px] text-slate-400 block mt-1">Supports PNG, JPEG up to 10MB</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleSearchImageChange}
                        disabled={isScanning}
                        className="absolute inset-0 opacity-0 cursor-pointer z-30"
                      />
                    </div>
                  </div>

                  {/* Settings Panel */}
                  <div className="flex flex-col gap-4">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Search Configurations</span>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-slate-600">Cosine Tolerance Threshold</label>
                        <span className="text-xs font-mono font-bold text-blue-600">{tolerance}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.1" 
                        max="1.0" 
                        step="0.05"
                        value={tolerance}
                        onChange={(e) => setTolerance(parseFloat(e.target.value))}
                        disabled={isScanning}
                        className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-100 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                        <span>Strict Match (0.2)</span>
                        <span>Lenient Match (1.0)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Audit Search Reason</label>
                      <input 
                        type="text" 
                        required
                        value={searchReason}
                        onChange={(e) => setSearchReason(e.target.value)}
                        disabled={isScanning}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                        placeholder="Suspect identification lookup"
                      />
                    </div>

                    <button 
                      onClick={handleIdentifySearch}
                      disabled={isScanning || !searchImage}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow mt-auto transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isScanning ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Running 1:N Biometric Search...
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-5 h-5" />
                          Execute Identification Search
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status and search result rendering */}
              {searchStatus.message && (
                <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 ${
                  searchStatus.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                  searchStatus.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {searchStatus.message}
                </div>
              )}

              {/* VIEW: DOSSIER VIEW (RESULTS CARD) */}
              {searchResult && searchResult.match_found && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden font-sans">
                  
                  {/* Banner Header */}
                  <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white border-b border-slate-800">
                    <div>
                      <h3 className="font-bold text-base flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        POSITIVE MATCH FOUND
                      </h3>
                      <p className="text-xs text-slate-400">Aggregated Chronological Record Dossier</p>
                    </div>
                    <div className="bg-slate-800/80 px-4 py-2 border border-slate-700 rounded-lg text-right">
                      <span className="block text-[10px] text-slate-400 font-mono uppercase tracking-wider">Similarity Score</span>
                      <span className="text-base font-bold text-emerald-400">{(searchResult.confidence_score * 100).toFixed(2)}% Match</span>
                    </div>
                  </div>

                  {/* Side-by-side biometric comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-100 bg-slate-50/50 p-6 gap-6">
                    
                    {/* Left Pane: Suspect image */}
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Search Query Image</span>
                      <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square max-h-[300px] bg-white flex items-center justify-center relative">
                        <img 
                          src={searchImagePreview} 
                          alt="Suspect Query" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Right Pane: Stored Image */}
                    <div>
                      <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">Stored Master Mugshot</span>
                      <div className="rounded-xl overflow-hidden border border-slate-200 aspect-square max-h-[300px] bg-white flex items-center justify-center relative">
                        {searchResult.criminal_profile.image_url ? (
                          <img 
                            src={`${API_BASE}${searchResult.criminal_profile.image_url}`} 
                            alt="Stored Master Profile" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-slate-400 font-mono text-sm">NO IMAGE FOUND</div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Profile details and administrative action buttons */}
                  <div className="p-6">
                    <div className="flex justify-between items-start flex-wrap gap-4 border-b border-slate-100 pb-4 mb-6">
                      <div>
                        <h4 className="text-xl font-bold text-slate-900">{searchResult.criminal_profile.true_name}</h4>
                        <span className="block text-xs text-slate-400 font-mono mt-0.5">UID: {searchResult.criminal_profile.system_uid}</span>
                      </div>
                      
                      {userRole === 'admin' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openEditModal({
                              id: criminals.find(cr => cr.system_uid === searchResult.criminal_profile.system_uid)?.id,
                              first_name: searchResult.criminal_profile.true_name.split(' ')[0],
                              last_name: searchResult.criminal_profile.true_name.split(' ')[1] || '',
                              gender: searchResult.criminal_profile.gender,
                              nationality: searchResult.criminal_profile.nationality,
                              distinguishing_marks: searchResult.criminal_profile.distinguishing_marks
                            })}
                            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all active:scale-95"
                          >
                            <Edit3 className="w-4 h-4 text-slate-500" />
                            Modify Record
                          </button>
                          
                          <button 
                            onClick={() => {
                              const crId = criminals.find(cr => cr.system_uid === searchResult.criminal_profile.system_uid)?.id;
                              if (crId) setExpungingId(crId);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-all active:scale-95"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                            Expunge Profile
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Metadata attributes */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Date of Birth</span>
                        <span className="block text-sm font-semibold text-slate-800 mt-1">{searchResult.criminal_profile.dob}</span>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Gender Profile</span>
                        <span className="block text-sm font-semibold text-slate-800 mt-1">{searchResult.criminal_profile.gender || 'N/A'}</span>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Nationality</span>
                        <span className="block text-sm font-semibold text-slate-800 mt-1">{searchResult.criminal_profile.nationality || 'N/A'}</span>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Known Aliases</span>
                        <span className="block text-sm font-semibold text-slate-800 mt-1">
                          {searchResult.criminal_profile.aliases.join(', ')}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 mb-8">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Distinguishing Physical Marks</span>
                      <p className="text-sm font-medium text-slate-700 mt-1">{searchResult.criminal_profile.distinguishing_marks || 'None cataloged.'}</p>
                    </div>

                    {/* Incident Timeline */}
                    <h5 className="font-bold text-sm text-slate-500 uppercase tracking-widest font-mono mb-4 border-b border-slate-100 pb-2">Arrest Incident Record Timeline</h5>
                    
                    <div className="relative border-l-2 border-slate-200 pl-6 ml-3 flex flex-col gap-6">
                      {searchResult.historical_records.map((rec, idx) => (
                        <div key={idx} className="relative">
                          {/* Dot marker */}
                          <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm flex items-center justify-center" />
                          
                          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                                {rec.charge_category}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {rec.arrest_date}
                              </span>
                            </div>

                            <p className="text-sm font-semibold text-slate-800 mb-1">Arrest Incident Details:</p>
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">{rec.charge_details}</p>
                            
                            {rec.modus_operandi && (
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                                <span className="font-bold text-[10px] uppercase text-slate-400 font-mono block mb-1">Modus Operandi</span>
                                <span className="text-slate-700">{rec.modus_operandi}</span>
                              </div>
                            )}

                            {rec.notes && (
                              <div className="mt-2 text-xs text-slate-500">
                                <span className="font-bold">Investigator Notes: </span> {rec.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* VIEW: IMMUTABLE AUDIT LOGS */}
          {activeTab === 'audit' && userRole === 'admin' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden font-sans">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Regulatory Audit Logs</h2>
                  <p className="text-xs text-slate-400">View compliance records of queries, profiles enrollments, and identity match checks</p>
                </div>
                <button 
                  onClick={fetchData} 
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Logs
                </button>
              </div>

              {loading && auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400">Loading audit records...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400">No logs stored yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 uppercase text-[11px] font-mono tracking-wider border-b border-slate-200">
                        <th className="py-4 px-6">Timestamp</th>
                        <th className="py-4 px-6">User ID</th>
                        <th className="py-4 px-6">Action</th>
                        <th className="py-4 px-6">IP Address</th>
                        <th className="py-4 px-6">Reason for search</th>
                        <th className="py-4 px-6">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 font-mono text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-700">{log.user_id}</td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                              log.action.includes('SUCCESS') ? 'bg-emerald-50 text-emerald-700' :
                              log.action.includes('FAILED') ? 'bg-rose-50 text-rose-700' :
                              log.action.includes('EXPUNGE') ? 'bg-amber-50 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-mono text-slate-600">{log.ip_address}</td>
                          <td className="py-4 px-6 italic text-slate-500">{log.reason || 'None provided'}</td>
                          <td className="py-4 px-6 font-medium text-slate-700 max-w-xs truncate" title={log.details}>
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* MODAL: ADMINISTRATIVE PROFILE MODIFICATION */}
      {editingCriminal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-sm uppercase font-mono tracking-wider">Modify Criminal Profile</h3>
              <button onClick={() => setEditingCriminal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">First Name</label>
                  <input 
                    type="text" 
                    required
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name</label>
                  <input 
                    type="text" 
                    required
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                  <select 
                    value={editForm.gender}
                    onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nationality</label>
                  <input 
                    type="text" 
                    required
                    value={editForm.nationality}
                    onChange={(e) => setEditForm({...editForm, nationality: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Distinguishing Marks / Aliases</label>
                <textarea 
                  required
                  value={editForm.distinguishing_marks}
                  onChange={(e) => setEditForm({...editForm, distinguishing_marks: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-slate-50 h-20 resize-none"
                />
              </div>

              <div className="border-t border-slate-100 pt-4 mt-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1 text-rose-700">Reason for Administrative Change (Required for Audit Trail)</label>
                <input 
                  type="text" 
                  required
                  value={editForm.reason}
                  onChange={(e) => setEditForm({...editForm, reason: e.target.value})}
                  className="w-full border border-rose-200 focus:border-rose-500 rounded-lg px-3 py-2 text-sm focus:outline-none bg-slate-50"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setEditingCriminal(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow"
                >
                  Save Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROFILE EXPUNGEMENT CONFIRMATION */}
      {expungingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-rose-900 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-sm uppercase font-mono tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-300" />
                CRITICAL: Expunge Profile
              </h3>
              <button onClick={() => setExpungingId(null)} className="text-rose-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                This administrative action will permanently delete the criminal profile, all associated case record histories, and biometric mugshot embeddings from CFRMS servers. This action is irreversible.
              </p>

              <div>
                <label className="block text-xs font-bold text-rose-950 uppercase tracking-wider font-mono mb-2">Reason for Expungement (Required)</label>
                <input 
                  type="text" 
                  required
                  value={expungeReason}
                  onChange={(e) => setExpungeReason(e.target.value)}
                  className="w-full border border-rose-200 focus:border-rose-500 rounded-lg px-3 py-2 text-sm focus:outline-none bg-slate-50"
                  placeholder="Court order expungement / record error"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setExpungingId(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleExpungeSubmit}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow"
                >
                  Confirm Permanent Deletion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
