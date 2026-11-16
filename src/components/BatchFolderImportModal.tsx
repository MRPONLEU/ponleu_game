import React from 'react';
import { WordItem, QuizQuestion, Topic } from '../types';
import { 
  FolderArchive, 
  Folder, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2, 
  CheckSquare, 
  Square, 
  Layers, 
  Trash2, 
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playClickSound, playSuccessSound, playFailSound } from '../utils/audio';
import { parseMultiSheetTopicExcel } from '../utils/excelHelper';

interface BatchFolderImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTopics: (newTopics: Topic[]) => void;
  existingTopics: Topic[];
}

interface ParsedLessonItem {
  id: string;
  file: File;
  fileName: string;
  topicName: string;
  selected: boolean;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
  difficultWords: WordItem[];
  antonymWords: WordItem[];
  shortPassages: WordItem[];
  quizQuestions: QuizQuestion[];
  isExpanded?: boolean;
}

export default function BatchFolderImportModal({
  isOpen,
  onClose,
  onImportTopics,
  existingTopics
}: BatchFolderImportModalProps) {
  const folderInputRef = React.useRef<HTMLInputElement | null>(null);
  const multiFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = React.useState(false);
  const [folderName, setFolderName] = React.useState('ថ្នាក់ទី៦');
  const [isParsing, setIsParsing] = React.useState(false);
  const [parseProgress, setParseProgress] = React.useState({ current: 0, total: 0, currentFileName: '' });
  const [parsedLessons, setParsedLessons] = React.useState<ParsedLessonItem[]>([]);
  const [prefixWithFolder, setPrefixWithFolder] = React.useState(false);
  const [attachFolderTag, setAttachFolderTag] = React.useState(true);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setParsedLessons([]);
      setIsParsing(false);
      setGeneralError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const processFiles = async (files: File[]) => {
    setGeneralError(null);

    const excelFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv');
      const isNotTemp = !name.startsWith('~$') && !name.startsWith('.');
      return isExcel && isNotTemp;
    });

    if (excelFiles.length === 0) {
      setGeneralError('រកមិនឃើញឯកសារ Excel (.xlsx, .xls, .csv) នៅក្នុង Folder នេះទេ។ សូមពិនិត្យមើល Folder ម្តងទៀត!');
      playFailSound();
      return;
    }

    let detectedName = '';
    for (const f of excelFiles) {
      if (f.webkitRelativePath) {
        const parts = f.webkitRelativePath.split('/');
        if (parts.length > 1 && parts[0].trim()) {
          detectedName = parts[0].trim();
          break;
        }
      }
    }
    if (detectedName) {
      setFolderName(detectedName);
    }

    setIsParsing(true);
    setParseProgress({ current: 0, total: excelFiles.length, currentFileName: '' });

    const results: ParsedLessonItem[] = [];

    for (let i = 0; i < excelFiles.length; i++) {
      const file = excelFiles[i];
      setParseProgress({ current: i + 1, total: excelFiles.length, currentFileName: file.name });

      const cleanName = file.name
        .replace(/.[^/.]+$/, '')
        .replace(/_Template$/i, '')
        .trim();

      try {
        const parsed = await parseMultiSheetTopicExcel(file);
        results.push({
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          file,
          fileName: file.name,
          topicName: parsed.topicName || cleanName,
          selected: true,
          status: 'success',
          difficultWords: parsed.difficultWords,
          antonymWords: parsed.antonymWords || [],
          shortPassages: parsed.shortPassages,
          quizQuestions: parsed.quizQuestions,
          isExpanded: false
        });
      } catch (err: any) {
        console.error('Error parsing file:', file.name, err);
        results.push({
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          file,
          fileName: file.name,
          topicName: cleanName,
          selected: false,
          status: 'error',
          errorMessage: 'មិនអាចអានទិន្នន័យពី Excel បានទេ',
          difficultWords: [],
          antonymWords: [],
          shortPassages: [],
          quizQuestions: [],
          isExpanded: false
        });
      }
    }

    setParsedLessons(results);
    setIsParsing(false);
    playSuccessSound();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      playClickSound();
      processFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    const files: File[] = [];

    if (items && items.length > 0) {
      const scanEntry = async (entry: any, path = ''): Promise<void> => {
        if (!entry) return;
        if (entry.isFile) {
          return new Promise((resolve) => {
            entry.file((file: File) => {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: path ? `${path}/${file.name}` : file.name,
                writable: true
              });
              files.push(file);
              resolve();
            });
          });
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          return new Promise((resolve) => {
            dirReader.readEntries(async (entries: any[]) => {
              for (const childEntry of entries) {
                await scanEntry(childEntry, path ? `${path}/${entry.name}` : entry.name);
              }
              resolve();
            });
          });
        }
      };

      const entryPromises: Promise<void>[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item.webkitGetAsEntry === 'function') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            entryPromises.push(scanEntry(entry));
          }
        } else if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      await Promise.all(entryPromises);
    } else if (e.dataTransfer.files) {
      files.push(...(Array.from(e.dataTransfer.files) as File[]));
    }

    if (files.length > 0) {
      playClickSound();
      processFiles(files);
    }
  };

  const handleToggleSelectAll = (select: boolean) => {
    playClickSound();
    setParsedLessons(prev => prev.map(item => item.status === 'success' ? { ...item, selected: select } : item));
  };

  const handleToggleItem = (id: string) => {
    playClickSound();
    setParsedLessons(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const handleToggleExpand = (id: string) => {
    setParsedLessons(prev => prev.map(item => item.id === id ? { ...item, isExpanded: !item.isExpanded } : item));
  };

  const handleUpdateTopicName = (id: string, newName: string) => {
    setParsedLessons(prev => prev.map(item => item.id === id ? { ...item, topicName: newName } : item));
  };

  const handleRemoveItem = (id: string) => {
    playClickSound();
    setParsedLessons(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmImport = () => {
    const selected = parsedLessons.filter(item => item.selected && item.status === 'success');
    if (selected.length === 0) {
      setGeneralError('សូមជ្រើសរើសយ៉ាងហោចណាស់ ១ មេរៀនដើម្បីបញ្ចូល!');
      playFailSound();
      return;
    }

    playClickSound();

    const cleanFolder = folderName.trim() || 'ថ្នាក់ទី៦';
    const newTopics: Topic[] = selected.map((lesson, index) => {
      const finalName = prefixWithFolder 
        ? `[${cleanFolder}] ${lesson.topicName}`
        : lesson.topicName;

      return {
        id: `topic-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        name: finalName,
        description: `ថ្នាក់/Folder: ${cleanFolder} • នាំចូលពី: ${lesson.fileName}`,
        folderName: attachFolderTag ? cleanFolder : undefined,
        difficultWords: lesson.difficultWords,
        antonymWords: lesson.antonymWords,
        shortPassages: lesson.shortPassages,
        quizQuestions: lesson.quizQuestions,
        createdAt: Date.now() - index * 1000
      };
    });

    onImportTopics(newTopics);
    playSuccessSound();
    onClose();
  };

  const selectedCount = parsedLessons.filter(item => item.selected && item.status === 'success').length;
  const totalDifficultWords = parsedLessons
    .filter(i => i.selected && i.status === 'success')
    .reduce((sum, i) => sum + i.difficultWords.length, 0);
  const totalAntonyms = parsedLessons
    .filter(i => i.selected && i.status === 'success')
    .reduce((sum, i) => sum + i.antonymWords.length, 0);
  const totalPassages = parsedLessons
    .filter(i => i.selected && i.status === 'success')
    .reduce((sum, i) => sum + i.shortPassages.length, 0);
  const totalQuiz = parsedLessons
    .filter(i => i.selected && i.status === 'success')
    .reduce((sum, i) => sum + i.quizQuestions.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <input
        ref={folderInputRef}
        type="file"
        {...{ webkitdirectory: '', directory: '' }}
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={multiFileInputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FolderArchive size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  បញ្ចូលមេរៀនជា Folder (Batch Folder Import)
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  ស្វ័យប្រវត្តិ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ជ្រើសរើស Folder ដែលមានឯកសារ Excel (៤ Sheet) ច្រើន ដើម្បីរៀបចំមេរៀនទាំងអស់ក្នុងពេលតែមួយ
              </p>
            </div>
          </div>
          <button
            onClick={() => { playClickSound(); onClose(); }}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* General Error Banner */}
        {generalError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-semibold">
            <AlertCircle size={18} className="shrink-0" />
            <span className="flex-1">{generalError}</span>
            <button onClick={() => setGeneralError(null)} className="cursor-pointer text-rose-500 hover:text-rose-700">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STATE 1: PARSING PROGRESS */}
          {isParsing && (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner relative">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <div className="max-w-md">
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  កំពុងអាន និងរៀបចំមេរៀន ({parseProgress.current}/{parseProgress.total})...
                </h3>
                <p className="text-xs text-slate-500 truncate" title={parseProgress.currentFileName}>
                  ឯកសារ ៖ {parseProgress.currentFileName || 'កំពុងដំណើរការ...'}
                </p>
              </div>
              <div className="w-full max-w-md bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${parseProgress.total ? (parseProgress.current / parseProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* STATE 2: NO FILES SELECTED YET - DROPZONE & PICKERS */}
          {!isParsing && parsedLessons.length === 0 && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all flex flex-col items-center justify-center ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50/60 scale-[0.99]' 
                  : 'border-slate-200 hover:border-blue-400 bg-slate-50/60'
              }`}
            >
              <div className="w-20 h-20 rounded-3xl bg-blue-100/70 text-blue-600 flex items-center justify-center mb-5 shadow-xs">
                <FolderArchive size={40} />
              </div>

              <h3 className="text-lg font-bold text-slate-800 mb-2">
                ទម្លាក់ Folder ចូលទីនេះ ឬចុចប៊ូតុងខាងក្រោម
              </h3>
              <p className="text-xs text-slate-500 max-w-lg mb-6 leading-relaxed">
                កម្មវិធីនឹងស្វែងរក និងរៀបចំរាល់ឯកសារ Excel (.xlsx, .xls, .csv) ទាំងអស់ក្នុង Folder ដោយស្វ័យប្រវត្តិតាមឈ្មោះឯកសារ និង Sheet ទាំង ៤ (ពាក្យពិបាក, ពាក្យផ្ទុយ, អត្ថបទខ្លី, និងសំណួរ)
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    folderInputRef.current?.click();
                  }}
                  id="btn-pick-folder"
                  className="flex-1 min-w-[200px] py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Folder size={18} />
                  <span>ជ្រើសរើស Folder ទាំងមូល</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    multiFileInputRef.current?.click();
                  }}
                  id="btn-pick-multi-files"
                  className="flex-1 min-w-[200px] py-3.5 px-6 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet size={18} className="text-emerald-600" />
                  <span>ឬ ជ្រើសរើស Files ច្រើន</span>
                </button>
              </div>

              {/* Helpful tip box */}
              <div className="mt-8 p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl text-left max-w-md text-xs text-blue-900/80 leading-relaxed flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">គំរូទម្រង់ ៖ </span>
                  Folder <span className="font-bold text-blue-700">ថ្នាក់ទី៦</span> ដែលមានឯកសារ <span className="font-medium text-slate-700">អំណាន ៖ បុណ្យតាមជំនឿព្រះពុទ្ធសាសនា.xlsx, អំណាន ៖ ពិធីបុណ្យសព.xlsx, ...</span> នឹងត្រូវបម្លែងជាមេរៀនដោយស្វ័យប្រវត្តិ។
                </div>
              </div>
            </div>
          )}

          {/* STATE 3: FILES PARSED - REVIEW & CONFIGURE */}
          {!isParsing && parsedLessons.length > 0 && (
            <div className="space-y-6">
              {/* Folder Configuration Card */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Folder size={15} className="text-blue-600" />
                    <span>ឈ្មោះ Folder / កម្រិតថ្នាក់ (Category)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      placeholder="ឧ. ថ្នាក់ទី៦ ឬ មេរៀនភាសាខ្មែរ"
                      className="w-full bg-white px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Overall counts */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-1.5 font-bold text-slate-700">
                    <Layers size={14} className="text-blue-600" />
                    <span>{selectedCount}/{parsedLessons.length} មេរៀន</span>
                  </div>
                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-1.5 font-bold text-indigo-600">
                    <span>{totalDifficultWords} ពាក្យពិបាក</span>
                  </div>
                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-1.5 font-bold text-amber-600">
                    <span>{totalAntonyms} ពាក្យផ្ទុយ</span>
                  </div>
                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-1.5 font-bold text-emerald-600">
                    <span>{totalPassages} អត្ថបទ</span>
                  </div>
                  <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-1.5 font-bold text-purple-600">
                    <span>{totalQuiz} MCQ</span>
                  </div>
                </div>
              </div>

              {/* Toggles & Selection bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-600 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <CheckSquare size={15} />
                    <span>ជ្រើសរើសទាំងអស់</span>
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    <Square size={15} />
                    <span>ដោះការជ្រើសរើស</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={attachFolderTag}
                      onChange={(e) => setAttachFolderTag(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>ដាក់ Tag ក្រុម «{folderName || 'Folder'}»</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={prefixWithFolder}
                      onChange={(e) => setPrefixWithFolder(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>បន្ថែម [{folderName || 'Folder'}] ពីមុខឈ្មោះ</span>
                  </label>
                </div>
              </div>

              {/* Lesson Items List */}
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {parsedLessons.map((item, index) => {
                  const isSuccess = item.status === 'success';
                  const isExisting = existingTopics.some(t => t.name.trim().toLowerCase() === item.topicName.trim().toLowerCase());

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        !isSuccess 
                          ? 'bg-rose-50/50 border-rose-200' 
                          : item.selected
                            ? 'bg-white border-blue-200 shadow-xs ring-1 ring-blue-500/10'
                            : 'bg-slate-50/60 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <button
                          type="button"
                          disabled={!isSuccess}
                          onClick={() => handleToggleItem(item.id)}
                          className="text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-30 cursor-pointer"
                        >
                          {item.selected ? (
                            <CheckSquare size={20} className="text-blue-600" />
                          ) : (
                            <Square size={20} />
                          )}
                        </button>

                        {/* Index & File icon */}
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </div>

                        {/* Title input */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.topicName}
                              onChange={(e) => handleUpdateTopicName(item.id, e.target.value)}
                              className="text-sm font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full py-0.5 truncate"
                              title="ចុចដើម្បីកែឈ្មោះមេរៀន"
                            />
                            {isExisting && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md shrink-0">
                                ឈ្មោះជាន់គ្នា
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-2 mt-0.5">
                            <FileSpreadsheet size={12} className="text-slate-400" />
                            <span>{item.fileName}</span>
                            {item.status === 'error' && (
                              <span className="text-rose-600 font-medium">({item.errorMessage})</span>
                            )}
                          </div>
                        </div>

                        {/* Sheet Counts Pills */}
                        {isSuccess && (
                          <div className="hidden sm:flex items-center gap-1.5 shrink-0 text-[11px] font-bold">
                            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg" title="ពាក្យពិបាក">
                              {item.difficultWords.length} ពិបាក
                            </span>
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-lg" title="ពាក្យផ្ទុយ">
                              {item.antonymWords.length} ផ្ទុយ
                            </span>
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg" title="អត្ថបទខ្លី">
                              {item.shortPassages.length} អត្ថបទ
                            </span>
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg" title="សំណួរ MCQ">
                              {item.quizQuestions.length} MCQ
                            </span>
                          </div>
                        )}

                        {/* Expand / Collapse Preview */}
                        {isSuccess && (
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(item.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                            title="មើលទិន្នន័យត្រួសៗ"
                          >
                            {item.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}

                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                          title="លុបចេញពីបញ្ជី"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Expanded Preview Details */}
                      {item.isExpanded && isSuccess && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2 pl-11">
                          {item.difficultWords.length > 0 && (
                            <div>
                              <span className="font-bold text-indigo-600">ពាក្យពិបាក ៖ </span>
                              <span>{item.difficultWords.slice(0, 5).map(w => w.word).join(', ')}{item.difficultWords.length > 5 ? '...' : ''}</span>
                            </div>
                          )}
                          {item.antonymWords.length > 0 && (
                            <div>
                              <span className="font-bold text-amber-600">ពាក្យផ្ទុយ ៖ </span>
                              <span>{item.antonymWords.slice(0, 4).map(w => w.word).join(', ')}{item.antonymWords.length > 4 ? '...' : ''}</span>
                            </div>
                          )}
                          {item.shortPassages.length > 0 && (
                            <div>
                              <span className="font-bold text-emerald-600">អត្ថបទ ៖ </span>
                              <span className="truncate inline-block max-w-[400px] align-bottom">{item.shortPassages[0].word}</span>
                            </div>
                          )}
                          {item.quizQuestions.length > 0 && (
                            <div>
                              <span className="font-bold text-purple-600">សំណួរគំរូ ៖ </span>
                              <span>{item.quizQuestions[0].question}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {parsedLessons.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  folderInputRef.current?.click();
                }}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>ជ្រើស Folder ផ្សេង</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { playClickSound(); onClose(); }}
              className="px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              បោះបង់
            </button>

            {parsedLessons.length > 0 && (
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={handleConfirmImport}
                id="btn-confirm-import-folder"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>បញ្ចូល {selectedCount} មេរៀនទាំងអស់</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
