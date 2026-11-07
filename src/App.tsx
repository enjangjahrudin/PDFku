import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Toolbar } from './components/layout/Toolbar';
import { Breadcrumb } from './components/layout/Breadcrumb';
import { Sidebar } from './components/layout/Sidebar';
import { FileGrid } from './components/explorer/FileGrid';
import { FileList } from './components/explorer/FileList';
import { ContextMenu } from './components/explorer/ContextMenu';
import { FolderDialog } from './components/explorer/FolderDialog';
import { ScannerModal } from './components/scanner/ScannerModal';
import { ConverterModal } from './components/converter/ConverterModal';
import { CompressorModal } from './components/tools/CompressorModal';
import { PdfToolsModal } from './components/tools/PdfToolsModal';
import { PreviewModal } from './components/preview/PreviewModal';
import { AuthModal } from './components/auth/AuthModal';
import { AdminDashboardModal } from './components/admin/AdminDashboardModal';
import { MoveDialog } from './components/explorer/MoveDialog';
import { useFileSystem } from './hooks/useFileSystem';
import { VirtualFile } from './types';
import { getFileExtension } from './utils/formatters';
import { Camera, Folder, FileText, Sparkles, Layers } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { convertJpgToPdf } from './services/pdfService';

export function App() {
  const {
    currentFolderId,
    files,
    folderTree,
    selectedIds,
    setSelectedIds,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    activeNav,
    setActiveNav,
    navigateToFolder,
    goBack,
    goForward,
    goUp,
    canGoBack,
    canGoForward,
    canGoUp,
    createFolder,
    addFile,
    renameFile,
    moveFiles,
    toggleFavorite,
    setColorTag,
    deleteFiles,
    restoreFiles,
    emptyRecycleBin,
    refreshAll
  } = useFileSystem();

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isCompressorOpen, setIsCompressorOpen] = useState(false);
  const [isPdfToolsOpen, setIsPdfToolsOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<VirtualFile | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Move Dialog state
  const [moveDialogState, setMoveDialogState] = useState<{
    isOpen: boolean;
    files: VirtualFile[];
  }>({ isOpen: false, files: [] });

  // Folder Dialog state (Create / Rename)
  const [folderDialogState, setFolderDialogState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'rename';
    targetId?: string;
    initialName?: string;
  }>({ isOpen: false, mode: 'create' });

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: VirtualFile | null;
  } | null>(null);

  // Keyboard Shortcuts: Delete, F2, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (folderDialogState.isOpen || isScannerOpen || isConverterOpen || isCompressorOpen || isPdfToolsOpen || previewFile) {
        return;
      }

      if (e.key === 'Delete' && selectedIds.length > 0) {
        deleteFiles(selectedIds, activeNav === 'recycle_bin');
      } else if (e.key === 'F2' && selectedIds.length === 1) {
        const file = files.find(f => f.id === selectedIds[0]);
        if (file) {
          setFolderDialogState({
            isOpen: true,
            mode: 'rename',
            targetId: file.id,
            initialName: file.name
          });
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setSelectedIds(files.map(f => f.id));
      } else if (e.key === 'Escape') {
        setSelectedIds([]);
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, files, activeNav, deleteFiles, folderDialogState, isScannerOpen, isConverterOpen, isCompressorOpen, isPdfToolsOpen, previewFile]);

  // Handle seleksi berkas
  const handleSelectFile = (id: string, multi: boolean) => {
    if (multi) {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  // Toggle Pilih Semua
  const handleToggleSelectAll = () => {
    if (selectedIds.length === files.length && files.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(files.map(f => f.id));
    }
  };

  // Download Masal (Bulk ZIP)
  const handleBulkDownloadZip = async () => {
    const selectedFiles = files.filter(f => selectedIds.includes(f.id) && !f.isFolder && f.blob);
    if (selectedFiles.length === 0) return;

    const zip = new JSZip();
    for (const f of selectedFiles) {
      zip.file(f.name, f.blob!);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `PDFku_Unduhan_${selectedFiles.length}_Berkas.zip`);
  };

  // Gabung Masal ke PDF (Bulk Merge)
  const handleBulkMergePdf = async () => {
    const selectedImages = files.filter(f => selectedIds.includes(f.id) && !f.isFolder && f.blob && (f.type === 'jpg' || f.type === 'png'));
    if (selectedImages.length === 0) return;

    try {
      const blobs = selectedImages.map(f => f.blob!);
      const mergedPdfBlob = await convertJpgToPdf(blobs, { pageSize: 'A4', orientation: 'auto', margin: 'none' });
      const newName = `Gabungan_${selectedImages.length}_Gambar.pdf`;

      await addFile({
        name: newName,
        parentId: currentFolderId,
        type: 'pdf',
        isFolder: false,
        size: mergedPdfBlob.size,
        blob: mergedPdfBlob,
        thumbnail: selectedImages[0].thumbnail,
        pageCount: selectedImages.length,
        colorTag: '#3b82f6'
      });
      alert(`Berhasil menggabungkan ${selectedImages.length} gambar menjadi "${newName}"!`);
    } catch (err) {
      alert('Gagal menggabungkan ke PDF: ' + (err as Error).message);
    }
  };

  // Handle buka file atau folder
  const handleOpenFile = (file: VirtualFile) => {
    if (file.isFolder) {
      navigateToFolder(file.id);
    } else {
      setPreviewFile(file);
    }
  };

  // Handle klik kanan context menu
  const handleContextMenu = (e: React.MouseEvent, file: VirtualFile) => {
    e.preventDefault();
    if (!selectedIds.includes(file.id)) {
      setSelectedIds([file.id]);
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file
    });
  };

  // Handle direct file upload via toolbar or drag & drop
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    for (const f of Array.from(uploadedFiles)) {
      const ext = getFileExtension(f.name);
      const isPdf = ext === 'pdf';
      const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

      let thumbnail: string | undefined = undefined;
      if (isImg) {
        thumbnail = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(f);
        });
      }

      await addFile({
        name: f.name,
        parentId: currentFolderId,
        type: isPdf ? 'pdf' : (isImg ? 'jpg' : 'txt'),
        isFolder: false,
        size: f.size,
        blob: f,
        thumbnail
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles) return;

    for (const f of Array.from(droppedFiles)) {
      const ext = getFileExtension(f.name);
      const isPdf = ext === 'pdf';
      const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

      let thumbnail: string | undefined = undefined;
      if (isImg) {
        thumbnail = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(f);
        });
      }

      await addFile({
        name: f.name,
        parentId: currentFolderId,
        type: isPdf ? 'pdf' : (isImg ? 'jpg' : 'txt'),
        isFolder: false,
        size: f.size,
        blob: f,
        thumbnail
      });
    }
  };

  const selectedFile = selectedIds.length === 1 ? files.find(f => f.id === selectedIds[0]) : null;

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen overflow-hidden bg-white select-none text-gray-800"
    >
      {/* 1. Window Title Bar & Fast Action Launchers */}
      <TitleBar
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenConverter={() => setIsConverterOpen(true)}
        onOpenCompressor={() => setIsCompressorOpen(true)}
        onOpenPdfTools={() => setIsPdfToolsOpen(true)}
      />

      {/* 2. Ribbon Action Toolbar (Windows 11 style) */}
      <Toolbar
        onNewFolder={() => setFolderDialogState({ isOpen: true, mode: 'create', initialName: 'Folder Baru' })}
        onOpenScanner={() => setIsScannerOpen(true)}
        onUploadFile={handleUploadFiles}
        selectedCount={selectedIds.length}
        totalFilesCount={files.length}
        isAllSelected={selectedIds.length === files.length && files.length > 0}
        onToggleSelectAll={handleToggleSelectAll}
        onDeleteSelected={() => deleteFiles(selectedIds, activeNav === 'recycle_bin')}
        onRenameSelected={() => {
          if (selectedFile) {
            setFolderDialogState({
              isOpen: true,
              mode: 'rename',
              targetId: selectedFile.id,
              initialName: selectedFile.name
            });
          }
        }}
        onMoveSelected={() => {
          const filesToMove = files.filter(f => selectedIds.includes(f.id));
          if (filesToMove.length > 0) {
            setMoveDialogState({ isOpen: true, files: filesToMove });
          }
        }}
        onBulkDownloadZip={handleBulkDownloadZip}
        onBulkMergePdf={handleBulkMergePdf}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onChangeSort={(field) => {
          if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
          } else {
            setSortBy(field);
            setSortOrder('asc');
          }
        }}
        onRefresh={refreshAll}
        isRecycleBin={activeNav === 'recycle_bin'}
        onEmptyRecycleBin={emptyRecycleBin}
        onRestoreSelected={() => restoreFiles(selectedIds)}
      />

      {/* 3. Address Bar / Breadcrumb & Search */}
      <Breadcrumb
        currentFolderId={currentFolderId}
        folderTree={folderTree}
        onNavigate={navigateToFolder}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        canGoUp={canGoUp}
        onGoBack={goBack}
        onGoForward={goForward}
        onGoUp={goUp}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeNav={activeNav}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
      />

      {/* 4. Main Body: Sidebar + File Explorer View */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar (Persistent on Desktop, Drawer on Mobile) */}
        <Sidebar
          currentFolderId={currentFolderId}
          folderTree={folderTree}
          onNavigate={navigateToFolder}
          activeNav={activeNav}
          setActiveNav={setActiveNav}
          onNewFolder={() => setFolderDialogState({ isOpen: true, mode: 'create', initialName: 'Folder Baru' })}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Center / Right Content Area */}
        <main
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedIds([]);
            }
          }}
          className="flex-1 overflow-y-auto bg-white pb-20 md:pb-0"
        >
          {viewMode === 'grid' ? (
            <FileGrid
              files={files}
              selectedIds={selectedIds}
              onSelect={handleSelectFile}
              onOpen={handleOpenFile}
              onContextMenu={handleContextMenu}
              onToggleFavorite={toggleFavorite}
            />
          ) : (
            <FileList
              files={files}
              selectedIds={selectedIds}
              onSelect={handleSelectFile}
              onOpen={handleOpenFile}
              onContextMenu={handleContextMenu}
              onToggleFavorite={toggleFavorite}
              onSelectAll={handleToggleSelectAll}
            />
          )}
        </main>
      </div>

      {/* 5. Mobile Bottom Navigation Bar (Jempol-Friendly ala CamScanner) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200 flex items-center justify-around px-2 z-30 shadow-lg select-none">
        {/* Tab 1: Buka Drawer Folder */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center text-gray-600 hover:text-blue-600 w-16 py-1 active:scale-95 transition"
        >
          <Folder className="w-5 h-5 mb-0.5 text-amber-500" />
          <span className="text-[10px] font-medium">Folder</span>
        </button>

        {/* Tab 2: Converter PDF ↔ JPG */}
        <button
          onClick={() => setIsConverterOpen(true)}
          className="flex flex-col items-center justify-center text-gray-600 hover:text-emerald-600 w-16 py-1 active:scale-95 transition"
        >
          <FileText className="w-5 h-5 mb-0.5 text-emerald-600" />
          <span className="text-[10px] font-medium">Konversi</span>
        </button>

        {/* Tab 3: BIG CAMERA SCAN BUTTON IN CENTER */}
        <div className="-mt-6">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex flex-col items-center justify-center shadow-xl ring-4 ring-white active:scale-90 transition hover:from-blue-700 hover:to-indigo-700"
            title="Scan Dokumen Kamera HP"
          >
            <Camera className="w-6 h-6" />
            <span className="text-[9px] font-bold mt-0.5 tracking-tight">SCAN</span>
          </button>
        </div>

        {/* Tab 4: Kompres PDF */}
        <button
          onClick={() => setIsCompressorOpen(true)}
          className="flex flex-col items-center justify-center text-gray-600 hover:text-indigo-600 w-16 py-1 active:scale-95 transition"
        >
          <Sparkles className="w-5 h-5 mb-0.5 text-indigo-500" />
          <span className="text-[10px] font-medium">Kompres</span>
        </button>

        {/* Tab 5: PDF Toolkit */}
        <button
          onClick={() => setIsPdfToolsOpen(true)}
          className="flex flex-col items-center justify-center text-gray-600 hover:text-blue-600 w-16 py-1 active:scale-95 transition"
        >
          <Layers className="w-5 h-5 mb-0.5 text-blue-500" />
          <span className="text-[10px] font-medium">Tools</span>
        </button>
      </nav>

      {/* Context Menu (Right Click) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu(null)}
          onOpen={handleOpenFile}
          onRename={(file) => {
            setFolderDialogState({
              isOpen: true,
              mode: 'rename',
              targetId: file.id,
              initialName: file.name
            });
          }}
          onDelete={(file) => deleteFiles([file.id], activeNav === 'recycle_bin')}
          onToggleFavorite={toggleFavorite}
          onSetColorTag={setColorTag}
          onMove={(file) => setMoveDialogState({ isOpen: true, files: [file] })}
          isRecycleBin={activeNav === 'recycle_bin'}
          onRestore={(file) => restoreFiles([file.id])}
        />
      )}

      {/* Move Files Dialog */}
      <MoveDialog
        isOpen={moveDialogState.isOpen}
        filesToMove={moveDialogState.files}
        folderTree={folderTree}
        onClose={() => setMoveDialogState({ isOpen: false, files: [] })}
        onConfirmMove={(targetFolderId) => {
          const ids = moveDialogState.files.map(f => f.id);
          moveFiles(ids, targetFolderId);
        }}
      />

      {/* Folder Dialog (Create / Rename) */}
      <FolderDialog
        isOpen={folderDialogState.isOpen}
        mode={folderDialogState.mode}
        initialName={folderDialogState.initialName}
        onClose={() => setFolderDialogState({ isOpen: false, mode: 'create' })}
        onSubmit={(name, colorTag) => {
          if (folderDialogState.mode === 'create') {
            createFolder(name, colorTag);
          } else if (folderDialogState.targetId) {
            renameFile(folderDialogState.targetId, name);
          }
        }}
      />

      {/* Magic Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSaveDocument={addFile}
        onCreateFolder={createFolder}
        onNavigateToFolder={navigateToFolder}
      />

      {/* Universal Converter Modal (PDF ↔ JPG) */}
      <ConverterModal
        isOpen={isConverterOpen}
        onClose={() => setIsConverterOpen(false)}
        onSaveToExplorer={addFile}
        onCreateFolder={createFolder}
        onNavigateToFolder={navigateToFolder}
      />

      {/* Smart PDF Compressor Modal */}
      <CompressorModal
        isOpen={isCompressorOpen}
        onClose={() => setIsCompressorOpen(false)}
        onSaveToExplorer={addFile}
      />

      {/* PDF Toolkit Modal (Merge, Split, Rotate) */}
      <PdfToolsModal
        isOpen={isPdfToolsOpen}
        onClose={() => setIsPdfToolsOpen(false)}
        onSaveToExplorer={addFile}
      />

      {/* Preview Modal (PDF / Image / OCR) */}
      <PreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {/* Autentikasi Pengguna & Login Modal */}
      <AuthModal />

      {/* Dashboard Administrator & Manajemen Pengguna */}
      <AdminDashboardModal />
    </div>
  );
}

export default App;
