"use client";
import Image from 'next/image';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Download, Eye, Music, Video, Calendar, HardDrive, X, Camera, 
  DownloadCloud, Trash2, AlertTriangle, FileText, Search, 
  ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Filter,
  Users, Folder, MessageSquare
} from 'lucide-react';
import JSZip from 'jszip';

// Tip tanımlamaları
interface FileData {
  key: string;
  name: string;
  fileName?: string;
  url: string;
  size: number;
  createdAt: number;
  type?: string;
  fileType?: 'image' | 'video' | 'audio' | 'text' | null;
}

interface ParticipantsData {
  participants: string[];
  lastUpdated: string;
  totalCount: number;
}

// Custom Audio Player component
const CustomAudioPlayer: React.FC<{ url: string; fileName: string }> = ({ url, fileName }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [url]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); // Card click event'ini engelle
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.error(err));
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2 w-full backdrop-blur-sm shadow-inner" onClick={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-violet-600 hover:from-rose-600 hover:to-violet-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 flex-shrink-0"
        >
          {isPlaying ? (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate" title={fileName}>{fileName}</p>
          <p className="text-rose-400/80 text-[10px] uppercase font-bold tracking-wider">Ses Anısı</p>
        </div>
      </div>
      
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:accent-rose-600 transition-colors"
        />
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
};

// Helper to format bytes to human-readable size
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const FileViewer: React.FC = () => {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // States
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'text' | 'participants'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc'>('date-desc');
  
  const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<number>(0);
  
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState<boolean>(false);
  const [fileToDelete, setFileToDelete] = useState<FileData | null>(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedCountInfo, setDeletedCountInfo] = useState(0);
  const [textContent, setTextContent] = useState<{[key: string]: string}>({});
  
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState<boolean>(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  
  const [groupByUser, setGroupByUser] = useState<boolean>(false);
  const [groupedFiles, setGroupedFiles] = useState<{ [username: string]: FileData[] }>({});
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Dosya türü klasör adını getiren fonksiyon
  const getFileTypeFolder = (fileType: 'image' | 'video' | 'audio' | 'text' | null): string => {
    switch (fileType) {
      case 'image':
        return 'Fotograflar';
      case 'video':
        return 'Videolar';
      case 'audio':
        return 'Ses_Kayitlari';
      case 'text':
        return 'Notlar';
      default:
        return 'Diger';
    }
  };

  // Kullanıcı adını dosya adından çıkarma fonksiyonu
  const extractUsername = useCallback((fileName: string): string => {
    const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
    const parts = nameWithoutExtension.split(/_[fv]_/i);
    
    if (parts.length > 1) {
      return parts[0].trim().toLowerCase();
    }
    return nameWithoutExtension;
  }, []);

  // Dosyaları kullanıcılara göre gruplandırma
  const groupFilesByUser = useCallback((filesList: FileData[]): { [username: string]: FileData[] } => {
    const grouped: { [username: string]: FileData[] } = {};
    
    filesList.forEach(file => {
      const username = extractUsername(file.name);
      if (!grouped[username]) {
        grouped[username] = [];
      }
      grouped[username].push(file);
    });
    
    return grouped;
  }, [extractUsername]);

  // JSZip ile client-side toplu ZIP indirme
  const downloadFilesAsZip = async (filesToDownload: FileData[], zipName = "dugun_anilarimiz.zip"): Promise<void> => {
    if (filesToDownload.length === 0) return;
    
    setIsDownloadingAll(true);
    setZipProgress(0);
    
    try {
      const zip = new JSZip();
      let completedCount = 0;
      
      for (const file of filesToDownload) {
        try {
          const response = await fetch(file.url);
          const blob = await response.blob();
          
          const folderName = getFileTypeFolder(file.fileType || null);
          const cleanFileName = file.name.replace(/[<>:"/\\|?*]/g, '_');
          
          if (groupByUser) {
            const username = extractUsername(file.name).replace(/[<>:"/\\|?*]/g, '_');
            zip.folder(username)?.folder(folderName)?.file(cleanFileName, blob);
          } else {
            zip.folder(folderName)?.file(cleanFileName, blob);
          }
        } catch (fileErr) {
          console.error(`Dosya indirilirken hata oluştu (${file.name}):`, fileErr);
        }
        completedCount++;
        setZipProgress(Math.round((completedCount / filesToDownload.length) * 100));
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('ZIP toplu indirme hatası:', error);
      alert('İndirme sırasında bir hata oluştu. Teker teker indirmeyi deneyin.');
    } finally {
      setIsDownloadingAll(false);
      setZipProgress(0);
    }
  };

  const downloadUserFiles = async (username: string, userFiles: FileData[]): Promise<void> => {
    const cleanUsername = username.replace(/[<>:"/\\|?*]/g, '_');
    await downloadFilesAsZip(userFiles, `${cleanUsername}_anilarimiz.zip`);
  };
  
  // Katılımcıları yükle
  const loadParticipants = async (): Promise<void> => {
    try {
      setParticipantsLoading(true);
      const response = await fetch('/api/uploadthing');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Katılımcı dosyasını bul
        const participantsFile = data.files.find((file: any) => {
          const fileName = (file.name || file.fileName || '').toLowerCase();
          return fileName.includes('katilimci') || 
                 fileName.includes('katılımcı') ||
                 fileName.includes('participant') ||
                 fileName.endsWith('.json');
        });
        
        if (participantsFile) {
          try {
            const jsonResponse = await fetch(participantsFile.url);
            const text = await jsonResponse.text();
            const participantsData: ParticipantsData = JSON.parse(text);
            
            setParticipants(participantsData.participants || []);
            setParticipantsError(null);
          } catch (jsonError) {
            console.error('JSON parse hatası:', jsonError);
            setParticipantsError('JSON dosyası okunamadı');
          }
        } else {
          // Tüm JSON dosyalarını kontrol et
          const jsonFiles = data.files.filter((file: any) => 
            (file.name || file.fileName || '').toLowerCase().endsWith('.json')
          );
          
          if (jsonFiles.length > 0) {
            try {
              const jsonResponse = await fetch(jsonFiles[0].url);
              const participantsData = await jsonResponse.json();
              if (participantsData.participants) {
                setParticipants(participantsData.participants || []);
                setParticipantsError(null);
              } else {
                setParticipantsError('Katılımcı listesi verisi bulunamadı');
              }
            } catch (jsonError) {
              setParticipantsError('JSON okuma hatası');
            }
          } else {
            setParticipantsError('Katılımcı dosyası bulunamadı');
          }
        }
      }
    } catch (err) {
      console.error('Katılımcı listesi yükleme hatası:', err);
      setParticipantsError(err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setParticipantsLoading(false);
    }
  };

  useEffect(() => {
    if (groupByUser && files.length > 0) {
      const grouped = groupFilesByUser(files);
      setGroupedFiles(grouped);
    }
  }, [files, groupByUser, groupFilesByUser]);
  
  // Dosya silme fonksiyonu
  const deleteFile = async (fileKey: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/uploadthing?key=${fileKey}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Dosya silme hatası:', error);
      return false;
    }
  };

  // Tekli dosya silme
  const handleDeleteFile = async (file: FileData): Promise<void> => {
    const success = await deleteFile(file.key);
    if (success) {
      setFiles(prevFiles => prevFiles.filter(f => f.key !== file.key));
      setFileToDelete(null);
      if (selectedFile?.key === file.key) {
        setSelectedFile(null);
      }
      setDeletedCountInfo(1);
      setShowDeleteSuccess(true);
      setTimeout(() => setShowDeleteSuccess(false), 4000);
    } else {
      alert("Dosya silinirken bir hata oluştu.");
    }
  };

  // Tüm filtrelenmiş dosyaları silme
  const handleDeleteAllFiles = async (filesToDelete: FileData[]): Promise<void> => {
    if (filesToDelete.length === 0) return;
    setIsDeletingAll(true);
    let deletedCount = 0;
  
    try {
      for (const file of filesToDelete) {
        const success = await deleteFile(file.key);
        if (success) {
          deletedCount++;
          setFiles(prevFiles => prevFiles.filter(f => f.key !== file.key));
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      setDeletedCountInfo(deletedCount);
      setShowDeleteSuccess(true);
      setTimeout(() => setShowDeleteSuccess(false), 4000);
      setShowDeleteAllConfirm(false);
    } catch (error) {
      console.error('Toplu silme hatası:', error);
    } finally {
      setIsDeletingAll(false);
    }
  };

  // TXT dosya içeriğini okuma
  const fetchTextContent = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      return await response.text();
    } catch (error) {
      console.error('Metin dosyası okunamadı:', error);
      return 'Dosya içeriği yüklenemedi.';
    }
  };

  // Tekli dosya indirme
  const downloadFile = async (file: FileData): Promise<void> => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('İndirme hatası:', error);
      // Fallback
      window.open(file.url, '_blank');
    }
  };

  // Dosya tipini belirleme
  const getFileType = (file: { name: string; type?: string }): 'image' | 'video' | 'audio' | 'text' | null => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type?.toLowerCase();
    
    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension || '')) {
      return 'image';
    }
    if (mimeType?.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension || '')) {
      return 'video';
    }
    if (mimeType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(extension || '')) {
      return 'audio';
    }
    if (mimeType?.startsWith('text/') || ['txt', 'md', 'rtf', 'log'].includes(extension || '')) {
      return 'text';
    }
    return null;
  };

  // Dosyaları yükle
  useEffect(() => {
    const loadFiles = async (): Promise<void> => {
      try {
        setLoading(true);
        const response = await fetch('/api/uploadthing');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
          const supportedFiles: FileData[] = data.files
            .map((file: any) => ({
              ...file,
              fileType: getFileType(file),
              size: file.size || 0,
              createdAt: file.createdAt || Date.now(),
              name: file.name || 'İsimsiz dosya'
            }))
            .filter((file: FileData) => file.fileType !== null);
          
          setFiles(supportedFiles);
          const grouped = groupFilesByUser(supportedFiles);
          setGroupedFiles(grouped);
		  
          // TXT dosyalarının içeriğini yükle
          const textFiles = supportedFiles.filter(file => file.fileType === 'text');
          const textContentMap: {[key: string]: string} = {};
          
          for (const textFile of textFiles) {
            const content = await fetchTextContent(textFile.url);
            textContentMap[textFile.key] = content;
          }
          
          setTextContent(textContentMap);
          await loadParticipants();
        } else {
          throw new Error(data.error || 'Dosyalar yüklenemedi');
        }
      } catch (err) {
        console.error('Dosya yükleme hatası:', err);
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleUserExpansion = (username: string): void => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(username)) {
      newExpanded.delete(username);
    } else {
      newExpanded.add(username);
    }
    setExpandedUsers(newExpanded);
  };

  // Arama ve filtreye göre dosyaları filtrele
  const filteredFiles = (filter === 'participants' ? [] : files).filter(file => {
    const matchesFilter = filter === 'all' || file.fileType === filter;
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          extractUsername(file.name).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Filtrelenmiş dosyaları sırala
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortBy === 'date-desc') return b.createdAt - a.createdAt;
    if (sortBy === 'date-asc') return a.createdAt - b.createdAt;
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    if (sortBy === 'size-desc') return b.size - a.size;
    if (sortBy === 'size-asc') return a.size - b.size;
    return 0;
  });

  // Gruplandırılmış ve sıralanmış dosyalar
  const filteredGroupedFiles = groupByUser ? groupFilesByUser(sortedFiles) : {};

  // İstatistik hesaplamaları
  const fileCounts = {
    all: files.length,
    image: files.filter(f => f.fileType === 'image').length,
    video: files.filter(f => f.fileType === 'video').length,
    audio: files.filter(f => f.fileType === 'audio').length,
    text: files.filter(f => f.fileType === 'text').length
  };

  const totalStorageSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

  // Aktif filtrenin etiketini getir
  const getFilterLabel = (): string => {
    const filterLabels: Record<string, string> = {
      all: 'Tüm Anıları',
      image: 'Tüm Fotoğrafları',
      video: 'Tüm Videoları',
      audio: 'Tüm Ses Kayıtlarını',
      text: 'Tüm Mesajları',
      participants: 'Tüm Katılımcıları'
    };
    return filterLabels[filter];
  };

  // Sort label
  const getSortLabel = (): string => {
    const sortLabels: Record<string, string> = {
      'date-desc': 'Tarih (Yeniye Doğru)',
      'date-asc': 'Tarih (Eskiye Doğru)',
      'name-asc': 'İsim (A-Z)',
      'name-desc': 'İsim (Z-A)',
      'size-desc': 'Boyut (Büyükten Küçüğe)',
      'size-asc': 'Boyut (Küçükten Büyüğe)',
    };
    return sortLabels[sortBy];
  };

  // Slideshow Navigation
  const currentFilteredIndex = sortedFiles.findIndex(f => f.key === selectedFile?.key);
  const handlePrevFile = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentFilteredIndex > 0) {
      setSelectedFile(sortedFiles[currentFilteredIndex - 1]);
    }
  }, [currentFilteredIndex, sortedFiles]);

  const handleNextFile = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentFilteredIndex < sortedFiles.length - 1) {
      setSelectedFile(sortedFiles[currentFilteredIndex + 1]);
    }
  }, [currentFilteredIndex, sortedFiles]);

  // Modal keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedFile) return;
      if (e.key === 'ArrowLeft') {
        handlePrevFile();
      } else if (e.key === 'ArrowRight') {
        handleNextFile();
      } else if (e.key === 'Escape') {
        setSelectedFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, handlePrevFile, handleNextFile]);

  // Dosya içeriği gösterme komponenti
  const FileContent: React.FC<{ file: FileData; isModal?: boolean }> = ({ file, isModal = false }) => {
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>): void => {
      const target = e.target as HTMLImageElement;
      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZTJlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkdvcnVudHUgeXVrbGVuZW1lZGk8L3RleHQ+PC9zdmc+';
    };

    switch (file.fileType) {
      case 'image':
        return (
          <div className={`flex items-center justify-center ${isModal ? 'max-h-[70vh]' : 'h-52 bg-slate-950/40'}`}>
            <Image 
              src={file.url} 
              alt={file.name}
              width={isModal ? 900 : 400}
              height={isModal ? 650 : 250}
              className={`object-cover transition-transform duration-500 ${
                isModal 
                  ? 'max-w-full max-h-[70vh] rounded-lg object-contain' 
                  : 'w-full h-full group-hover:scale-105'
              }`}
              onError={handleImageError}
              unoptimized
            />
          </div>
        );

      case 'video':
        return (
          <div className={`flex items-center justify-center ${isModal ? 'max-h-[70vh]' : 'h-52 bg-slate-950/40'}`}>
            <video 
              controls 
              className={`rounded-lg ${
                isModal 
                  ? 'max-w-full max-h-[70vh]' 
                  : 'w-full h-full object-cover'
              }`}
              preload="metadata"
              onClick={(e) => e.stopPropagation()}
            >
              <source src={file.url} />
              Tarayıcınız video oynatmayı desteklemiyor.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className={`p-4 bg-slate-900/60 flex flex-col justify-center items-center ${isModal ? 'py-8' : 'h-52'}`}>
            {isModal ? (
              <div className="w-full max-w-lg">
                <CustomAudioPlayer url={file.url} fileName={file.name} />
              </div>
            ) : (
              <CustomAudioPlayer url={file.url} fileName={file.name} />
            )}
          </div>
        );

      case 'text':
        const content = textContent[file.key] || 'Yükleniyor...';
        const previewContent = isModal ? content : content.substring(0, 150) + (content.length > 150 ? '...' : '');
        
        return (
          <div className={`p-4 bg-slate-900/60 flex flex-col ${isModal ? 'max-h-[70vh]' : 'h-52 overflow-hidden'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-sky-500/20 p-2 rounded-lg text-sky-400">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">Mesaj Notu</span>
            </div>
            <div className={`bg-black/30 border border-white/5 rounded-lg p-3 overflow-y-auto flex-1 ${isModal ? 'max-h-96' : 'max-h-32'}`}>
              <pre className="text-gray-300 text-xs whitespace-pre-wrap font-sans break-all">
                {previewContent}
              </pre>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen pb-16 font-sans">
      {/* Toast Notification */}
      {showDeleteSuccess && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-rose-500/90 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-fade-in border border-rose-400/20">
          <span className="text-lg">🗑️</span>
          <span className="font-semibold">{deletedCountInfo} adet anı başarıyla silindi.</span>
        </div>
      )}

      {/* Modern Premium Header */}
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute top-0 left-1/4 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl -z-10"></div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-rose-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent mb-3">
          Sevdiklerimizin Gözünden En Güzel Anılar 🤍
        </h1>
        <p className="text-gray-400 text-sm md:text-lg max-w-2xl mx-auto font-medium">
          Düğün günümüzden yüklenen fotoğrafları, videoları, ses kayıtlarını ve tebrik mesajlarını keşfedin, indirin ve saklayın.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6">
        
        {/* STATS PANEL */}
        {!loading && !error && files.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
              <div className="bg-rose-500/20 p-3.5 rounded-xl text-rose-400">
                <Folder className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Toplam Anı</p>
                <h3 className="text-2xl font-bold text-white mt-0.5">{fileCounts.all}</h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
              <div className="bg-violet-500/20 p-3.5 rounded-xl text-violet-400">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Toplam Alan</p>
                <h3 className="text-2xl font-bold text-white mt-0.5">{formatBytes(totalStorageSize)}</h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
              <div className="bg-emerald-500/20 p-3.5 rounded-xl text-emerald-400">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Foto & Video</p>
                <h3 className="text-2xl font-bold text-white mt-0.5">{fileCounts.image + fileCounts.video}</h3>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 flex items-center gap-4">
              <div className="bg-sky-500/20 p-3.5 rounded-xl text-sky-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Ses & Mesaj</p>
                <h3 className="text-2xl font-bold text-white mt-0.5">{fileCounts.audio + fileCounts.text}</h3>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS & SEARCH BAR */}
        {!loading && !error && (
          <div className="glass-panel rounded-2xl p-4 mb-6 border border-white/10 shadow-lg relative z-30">
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              
              {/* Left Side: Filter Categories Dropdown & Group by toggle */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setShowCategoryMenu(!showCategoryMenu);
                      setShowSortMenu(false);
                    }}
                    className="w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-medium transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-rose-400" />
                      <span className="text-sm">
                        {filter === 'all' && `Tümü (${fileCounts.all})`}
                        {filter === 'image' && `📸 Fotoğraflar (${fileCounts.image})`}
                        {filter === 'video' && `🎥 Videolar (${fileCounts.video})`}
                        {filter === 'audio' && `🎵 Ses Kayıtları (${fileCounts.audio})`}
                        {filter === 'text' && `💬 Mesajlar (${fileCounts.text})`}
                        {filter === 'participants' && `👥 Katılımcılar (${participants.length})`}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform text-gray-400 ${showCategoryMenu ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCategoryMenu && (
                    <div className="absolute top-12 left-0 w-full sm:w-60 bg-[#0c0a1f] border border-white/10 rounded-xl shadow-2xl py-1.5 z-30 animate-fade-in">
                      {[
                        { key: 'all' as const, label: 'Tüm Anılar', icon: '📁', count: fileCounts.all },
                        { key: 'image' as const, label: 'Fotoğraflar', icon: '📸', count: fileCounts.image },
                        { key: 'video' as const, label: 'Videolar', icon: '🎥', count: fileCounts.video },
                        { key: 'audio' as const, label: 'Ses Kayıtları', icon: '🎵', count: fileCounts.audio },
                        { key: 'text' as const, label: 'Tebrik Mesajları', icon: '💬', count: fileCounts.text },
                        { key: 'participants' as const, label: 'Katılımcı Listesi', icon: '👥', count: participants.length }
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            setFilter(item.key);
                            setShowCategoryMenu(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center justify-between transition-colors text-sm ${
                            filter === item.key ? 'text-rose-400 bg-rose-500/5 font-semibold' : 'text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            filter === item.key 
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                              : 'bg-white/5 text-gray-400'
                          }`}>
                            {item.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {filter !== 'participants' && (
                  <button
                    onClick={() => setGroupByUser(!groupByUser)}
                    className={`w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-xl border transition-all flex items-center justify-center gap-2 ${
                      groupByUser
                        ? 'bg-gradient-to-r from-rose-500 to-violet-600 text-white border-rose-500/30 shadow-lg'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    <span>{groupByUser ? 'Grup Klasörleri Açık' : 'Kullanıcılara Göre Grupla'}</span>
                  </button>
                )}
              </div>

              {/* Right Side: Search Input and Sort options */}
              {filter !== 'participants' && (
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
                  
                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Dosya veya kullanıcı ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input pl-10 pr-4 py-2.5 w-full rounded-xl text-sm placeholder-gray-500 font-medium"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Sort Dropdown */}
                  <div className="relative w-full sm:w-56">
                    <button
                      onClick={() => {
                        setShowSortMenu(!showSortMenu);
                        setShowCategoryMenu(false);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl font-medium transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4 text-violet-400" />
                        <span className="text-sm truncate max-w-[140px]">{getSortLabel()}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform text-gray-400 ${showSortMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showSortMenu && (
                      <div className="absolute top-12 right-0 w-full bg-[#0c0a1f] border border-white/10 rounded-xl shadow-2xl py-1.5 z-30 animate-fade-in">
                        {[
                          { key: 'date-desc' as const, label: 'Tarih (Yeniye Doğru)' },
                          { key: 'date-asc' as const, label: 'Tarih (Eskiye Doğru)' },
                          { key: 'name-asc' as const, label: 'İsim (A-Z)' },
                          { key: 'name-desc' as const, label: 'İsim (Z-A)' },
                          { key: 'size-desc' as const, label: 'Boyut (Büyükten Küçüğe)' },
                          { key: 'size-asc' as const, label: 'Boyut (Küçükten Büyüğe)' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            onClick={() => {
                              setSortBy(item.key);
                              setShowSortMenu(false);
                            }}
                            className={`w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors text-sm ${
                              sortBy === item.key ? 'text-violet-400 bg-violet-500/5 font-semibold' : 'text-gray-300'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          </div>
        )}

        {/* Global Click Listeners for Dropdowns */}
        {(showCategoryMenu || showSortMenu) && (
          <div 
            className="fixed inset-0 z-20" 
            onClick={() => {
              setShowCategoryMenu(false);
              setShowSortMenu(false);
            }}
          ></div>
        )}

        {/* BULK ACTIONS BANNER */}
        {!loading && !error && filter !== 'participants' && sortedFiles.length > 0 && (
          <div className="glass-panel rounded-2xl p-4 mb-6 border border-white/10 bg-white/[0.01]">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-300 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-lg">
                  {sortedFiles.length} Anı Seçildi
                </span>
                {isDownloadingAll && (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-rose-500 to-violet-600 transition-all duration-300"
                        style={{ width: `${zipProgress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-semibold text-rose-400">
                      ZIP Paketleniyor... %{zipProgress}
                    </span>
                  </div>
                )}
                {isDeletingAll && (
                  <div className="flex items-center gap-2 text-rose-500 text-xs font-medium">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-rose-500 border-t-transparent"></div>
                    <span>Siliniyor...</span>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => downloadFilesAsZip(sortedFiles)}
                  disabled={isDownloadingAll || isDeletingAll}
                  className="flex-1 sm:flex-initial bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 disabled:from-gray-700 disabled:to-gray-800 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg text-sm"
                >
                  <DownloadCloud className="w-4.5 h-4.5" />
                  <span>Seçilenleri ZIP İndir</span>
                </button>
                
                <button
                  onClick={() => setShowDeleteAllConfirm(true)}
                  disabled={isDownloadingAll || isDeletingAll}
                  className="bg-white/5 border border-white/10 hover:bg-red-950/20 hover:border-red-500/20 hover:text-rose-400 disabled:opacity-50 text-gray-300 px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Tümünü Sil</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOADING SHIMMER SKELETON */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="glass-panel rounded-2xl overflow-hidden h-72 flex flex-col justify-between">
                <div className="shimmer h-48 w-full"></div>
                <div className="p-4 space-y-3">
                  <div className="shimmer h-4 w-3/4 rounded"></div>
                  <div className="flex justify-between items-center">
                    <div className="shimmer h-8 w-24 rounded-lg"></div>
                    <div className="shimmer h-8 w-16 rounded-lg"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ERROR STATE */}
        {error && !loading && (
          <div className="glass-panel border border-red-500/20 rounded-2xl p-6 text-center max-w-md mx-auto my-12 animate-fade-in bg-red-950/5">
            <div className="bg-red-500/20 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Hata Oluştu</h3>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              Yeniden Dene
            </button>
          </div>
        )}

        {/* PARTICIPANTS TAB VIEW */}
        {!loading && !error && filter === 'participants' && (
          <div className="glass-panel rounded-2xl p-6 md:p-8 animate-fade-in">
            <div className="text-center mb-8">
              <div className="bg-rose-500/10 text-rose-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                <Users className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                👥 Düğün Katılımcı Listesi
              </h2>
              <p className="text-gray-400 text-sm">
                Bizleri bu mutlu günümüzde yalnız bırakmayan sevdiklerimiz (Toplam: {participants.length} kişi)
              </p>
            </div>
            
            {participantsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-rose-500 border-t-transparent"></div>
                <span className="mt-3 text-sm text-gray-400">Katılımcı listesi yükleniyor...</span>
              </div>
            ) : participantsError ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center max-w-sm mx-auto text-gray-400 text-sm">
                <p>{participantsError}</p>
              </div>
            ) : participants.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">Henüz katılımcı listesi yüklenmedi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {participants.map((participant, index) => (
                  <div 
                    key={index} 
                    className="glass-panel bg-white/[0.01] hover:bg-white/5 rounded-xl p-4 flex items-center gap-3 transition-colors border border-white/5"
                  >
                    <div className="bg-gradient-to-r from-rose-500 to-violet-600 text-white rounded-lg w-8 h-8 flex items-center justify-center font-bold text-xs shadow-md">
                      {index + 1}
                    </div>
                    <span className="text-white font-medium capitalize truncate">
                      {participant}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && filter !== 'participants' && sortedFiles.length === 0 && (
          <div className="glass-panel rounded-2xl p-12 text-center max-w-md mx-auto my-12 animate-fade-in bg-white/[0.01]">
            <div className="bg-white/5 border border-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Folder className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Anı Bulunamadı</h3>
            <p className="text-gray-400 text-sm mb-6">
              {searchQuery ? 'Aramanızla eşleşen hiçbir medya anısı bulunamadı.' : 'Bu kategoride henüz yüklenmiş bir anı bulunmamaktadır.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              >
                Aramayı Temizle
              </button>
            )}
          </div>
        )}

        {/* GROUPED FILES VIEW */}
        {!loading && !error && filter !== 'participants' && groupByUser && Object.keys(filteredGroupedFiles).length > 0 && (
          <div className="space-y-6 animate-fade-in">
            {Object.entries(filteredGroupedFiles).map(([username, userFiles]) => (
              <div key={username} className="glass-panel rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02]">
                <div 
                  className="bg-white/[0.03] border-b border-white/5 p-4 cursor-pointer hover:bg-white/[0.05] transition-all"
                  onClick={() => toggleUserExpansion(username)}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="bg-gradient-to-r from-rose-500 to-violet-600 p-2.5 rounded-xl text-white shadow-md">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white capitalize">
                          {username.replace(/_/g, ' ')}
                        </h3>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {userFiles.length} paylaşılan anı var
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadUserFiles(username, userFiles);
                        }}
                        className="bg-rose-500 hover:bg-rose-600 p-2 rounded-xl text-white transition-all flex items-center gap-1.5 text-xs font-semibold shadow-lg"
                        title={`${username} kullanıcısının tüm dosyalarını ZIP olarak indir`}
                      >
                        <DownloadCloud className="w-4 h-4" />
                        <span className="hidden sm:inline">ZIP İndir</span>
                      </button>
                      <div className="text-xs text-gray-400 font-semibold bg-white/5 px-2.5 py-1.5 rounded-lg">
                        {expandedUsers.has(username) ? 'Gizle' : 'Göster'}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedUsers.has(username) ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>                  
                
                {expandedUsers.has(username) && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-fade-in">
                    {userFiles.map((file) => (
                      <div 
                        key={file.key} 
                        onClick={() => setSelectedFile(file)}
                        className="group glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer border border-white/5 bg-slate-900/20"
                      >                            
                        <div className="relative">
                          <FileContent file={file} />
                          <div className="absolute top-3 right-3 z-10">
                            <div className={`p-2 rounded-xl shadow-lg border backdrop-blur-md ${
                              file.fileType === 'image' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                              file.fileType === 'video' ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 
                              file.fileType === 'audio' ? 'bg-violet-500/20 border-violet-500/30 text-violet-400' : 
                              'bg-sky-500/20 border-sky-500/30 text-sky-400'
                            }`}>
                              {file.fileType === 'image' && <Camera className="w-4 h-4" />}
                              {file.fileType === 'video' && <Video className="w-4 h-4" />}
                              {file.fileType === 'audio' && <Music className="w-4 h-4" />}
                              {file.fileType === 'text' && <FileText className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <h3 className="font-semibold text-white text-xs truncate mb-2" title={file.name}>
                            {file.name}
                          </h3>
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-3">
                            <span>{formatBytes(file.size)}</span>
                            <span>{new Date(file.createdAt).toLocaleDateString('tr-TR')}</span>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadFile(file);
                              }}
                              className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all font-semibold"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>İndir</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileToDelete(file);
                              }}
                              className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 p-2 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* UNGROUPED GRID FILES VIEW */}
        {!loading && !error && filter !== 'participants' && !groupByUser && sortedFiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-fade-in">
            {sortedFiles.map((file) => (
              <div 
                key={file.key} 
                onClick={() => setSelectedFile(file)}
                className="group glass-panel glass-panel-hover rounded-2xl overflow-hidden flex flex-col justify-between cursor-pointer border border-white/5 bg-slate-900/20"
              >
                <div className="relative">
                  <FileContent file={file} />
                  <div className="absolute top-3 right-3 z-10">
                    <div className={`p-2 rounded-xl shadow-lg border backdrop-blur-md ${
                      file.fileType === 'image' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                      file.fileType === 'video' ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 
                      file.fileType === 'audio' ? 'bg-violet-500/20 border-violet-500/30 text-violet-400' : 
                      'bg-sky-500/20 border-sky-500/30 text-sky-400'
                    }`}>
                      {file.fileType === 'image' && <Camera className="w-4 h-4" />}
                      {file.fileType === 'video' && <Video className="w-4 h-4" />}
                      {file.fileType === 'audio' && <Music className="w-4 h-4" />}
                      {file.fileType === 'text' && <FileText className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-white text-xs truncate mb-2" title={file.name}>
                    {file.name}
                  </h3>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-3">
                    <span>{formatBytes(file.size)}</span>
                    <span>{new Date(file.createdAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(file);
                      }}
                      className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>İndir</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFileToDelete(file);
                      }}
                      className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 p-2 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADVANCED SLIDESHOW LIGHTBOX MODAL */}
        {selectedFile && (
          <div 
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in"
            onClick={() => setSelectedFile(null)}
          >
            <div 
              className="relative max-w-5xl w-full max-h-[90vh] glass-panel bg-slate-950/80 border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header inside modal */}
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/40">
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-bold text-white truncate pr-4">{selectedFile.name}</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatBytes(selectedFile.size)} • {new Date(selectedFile.createdAt).toLocaleString('tr-TR')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Content view box with left/right keys */}
              <div className="relative flex-1 p-4 md:p-8 flex items-center justify-center min-h-[300px]">
                {/* Left navigation arrow */}
                {currentFilteredIndex > 0 && (
                  <button
                    onClick={handlePrevFile}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center transition-all z-20 shadow-lg active:scale-95"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                <FileContent file={selectedFile} isModal={true} />

                {/* Right navigation arrow */}
                {currentFilteredIndex < sortedFiles.length - 1 && (
                  <button
                    onClick={handleNextFile}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white flex items-center justify-center transition-all z-20 shadow-lg active:scale-95"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
              
              {/* Footer inside modal */}
              <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/40 flex-wrap gap-3">
                <span className="text-xs text-gray-400 font-semibold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                  Anı {currentFilteredIndex + 1} / {sortedFiles.length}
                </span>

                <div className="flex space-x-2">
                  <button
                    onClick={() => downloadFile(selectedFile)}
                    className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white py-2 px-5 text-sm rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                  >
                    <Download className="w-4 h-4" />
                    <span>İndir</span>
                  </button>
                  <button
                    onClick={() => {
                      setFileToDelete(selectedFile);
                      setSelectedFile(null);
                    }}
                    className="bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500 text-rose-400 hover:text-white py-2 px-4 text-sm rounded-xl font-semibold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SINGLE DELETE CONFIRMATION MODAL */}
        {fileToDelete && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in">
            <div className="glass-panel border-white/10 bg-[#0c0a1f] rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-rose-500/20 p-3.5 rounded-full border border-rose-500/30 text-rose-400">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              </div>
              
              <h3 className="text-xl font-extrabold text-white text-center mb-2">
                Anıyı Silmek İstiyor musunuz?
              </h3>
              
              <p className="text-gray-400 text-sm text-center mb-6">
                &ldquo;<span className="font-semibold text-gray-300">{fileToDelete.name}</span>&rdquo; isimli anı kalıcı olarak silinecektir. Bu işlem geri alınamaz.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setFileToDelete(null)}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 px-4 rounded-xl font-semibold transition-all text-sm"
                >
                  İptal
                </button>
                <button
                  onClick={() => handleDeleteFile(fileToDelete)}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white py-3 px-4 rounded-xl font-bold transition-all text-sm shadow-lg"
                >
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BULK DELETE CONFIRMATION MODAL */}
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in">
            <div className="glass-panel border-white/10 bg-[#0c0a1f] rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-rose-500/20 p-3.5 rounded-full border border-rose-500/30 text-rose-400">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              </div>
              
              <h3 className="text-xl font-extrabold text-white text-center mb-2">
                Tüm Seçili Anıları Sil
              </h3>
              
              <p className="text-gray-400 text-sm text-center mb-6">
                {getFilterLabel()} ({sortedFiles.length} dosya) kalıcı olarak silinecektir. Bu işlem geri alınamaz.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 px-4 rounded-xl font-semibold transition-all text-sm"
                  disabled={isDeletingAll}
                >
                  İptal
                </button>
                <button
                  onClick={() => handleDeleteAllFiles(sortedFiles)}
                  disabled={isDeletingAll}
                  className="flex-1 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white py-3 px-4 rounded-xl font-bold transition-all disabled:opacity-75 text-sm shadow-lg"
                >
                  {isDeletingAll ? 'Siliniyor...' : 'Tümünü Sil'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileViewer;
