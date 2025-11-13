// File handling
let selectedFiles = [];
let convertedFiles = [];
let libraryReady = false;

// Configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB max per file
const MAX_TOTAL_FILES = 20; // Maximum number of files at once

// Detect mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const message = document.getElementById('message');
const downloadSection = document.getElementById('downloadSection');
const downloadLinks = document.getElementById('downloadLinks');
const downloadAllBtn = document.getElementById('downloadAllBtn');

// Check library readiness
function checkLibraryReady() {
    if (typeof heic2any !== 'undefined') {
        libraryReady = true;
        return true;
    }
    return false;
}

// Poll for library readiness
const libraryCheckInterval = setInterval(() => {
    if (checkLibraryReady()) {
        clearInterval(libraryCheckInterval);
    }
}, 100);

// Also check on window load
window.addEventListener('load', () => {
    setTimeout(() => {
        if (!checkLibraryReady()) {
            showMessage('Conversion library is still loading. Please wait a moment and try again.', 'error');
        }
    }, 2000);
});

// Add keyboard support for drop zone
dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
    }
});

// Mobile-specific: Handle touch events
if (isMobile) {
    dropZone.addEventListener('touchend', (e) => {
        e.preventDefault();
        fileInput.click();
    });
}

// Initialize
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
convertBtn.addEventListener('click', handleConvert);
clearBtn.addEventListener('click', handleClearAll);
downloadAllBtn.addEventListener('click', handleDownloadAll);

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        addFiles(files);
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
}

// Check if file is HEIC/HEIF (mobile-friendly detection)
function isHEICFile(file) {
    const fileName = file.name.toLowerCase();
    const fileType = file.type ? file.type.toLowerCase() : '';
    
    // Check extension first (most reliable)
    if (fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
        return true;
    }
    
    // Check MIME type (mobile browsers sometimes report this)
    if (fileType === 'image/heic' || 
        fileType === 'image/heif' || 
        fileType === 'image/heic-sequence' ||
        fileType === 'image/heif-sequence') {
        return true;
    }
    
    // iOS Safari specific handling
    if (isIOS && file.size > 0) {
        // iOS sometimes reports HEIC files with empty type or generic image type
        // But we need to be more careful - only trust if filename suggests HEIC
        // or if type is empty AND file is reasonably large (HEIC files are typically > 100KB)
        if (fileType === '' && file.size > 100000) {
            // Empty type on iOS with large file size might be HEIC
            // But we'll let the conversion library decide - accept it tentatively
            // The library will fail gracefully if it's not actually HEIC
            return true;
        }
        
        // If filename contains HEIC-related terms (even without extension)
        if (fileName.includes('heic') || fileName.includes('heif')) {
            return true;
        }
    }
    
    return false;
}

function addFiles(files) {
    const validFiles = [];
    const invalidFiles = [];
    const tooLargeFiles = [];
    const duplicateFiles = [];

    // Check total file count limit
    if (selectedFiles.length + files.length > MAX_TOTAL_FILES) {
        showMessage(`Maximum ${MAX_TOTAL_FILES} files allowed. Please select fewer files.`, 'error');
        return;
    }

    files.forEach(file => {
        // Check file type (mobile-friendly)
        if (!isHEICFile(file)) {
            invalidFiles.push(file.name);
            return;
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            tooLargeFiles.push(file.name);
            return;
        }

        // Check for duplicates
        if (selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            duplicateFiles.push(file.name);
            return;
        }

        validFiles.push(file);
    });

    // Show error messages - clear and helpful
    if (invalidFiles.length > 0) {
        // Log invalid files for debugging
        if (isIOS) {
            console.warn('Invalid files detected:', invalidFiles.map(name => {
                const file = files.find(f => f.name === name);
                return {
                    name: name,
                    type: file ? (file.type || '(empty)') : 'unknown',
                    size: file ? file.size : 'unknown'
                };
            }));
        }
        
        const errorMsg = isMobile 
            ? `Cannot convert: Selected files are not HEIC format. Please select HEIC files from your photo library. On iPhone, make sure to select files with .HEIC extension.`
            : `Cannot convert: The following files are not HEIC/HEIF format and were skipped: ${invalidFiles.slice(0, 3).join(', ')}${invalidFiles.length > 3 ? ' and ' + (invalidFiles.length - 3) + ' more' : ''}`;
        showMessage(errorMsg, 'error');
    }

    if (tooLargeFiles.length > 0) {
        const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
        const errorMsg = isMobile
            ? `Cannot convert: File is too large. Maximum file size is ${maxSizeMB}MB. Please select a smaller file.`
            : `Cannot convert: The following files are too large (maximum ${maxSizeMB}MB) and were skipped: ${tooLargeFiles.slice(0, 3).join(', ')}${tooLargeFiles.length > 3 ? ' and ' + (tooLargeFiles.length - 3) + ' more' : ''}`;
        showMessage(errorMsg, 'error');
    }

    if (duplicateFiles.length > 0 && validFiles.length > 0) {
        // Don't show error for duplicates if we have valid files
    }

    if (validFiles.length > 0) {
        validFiles.forEach(file => {
            selectedFiles.push(file);
        });
        updateFileList();
        updateButtons();
    }
}

function updateFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileName = document.createElement('span');
        fileName.className = 'file-name';
        fileName.textContent = file.name;
        
        const fileSize = document.createElement('span');
        fileSize.className = 'file-size';
        fileSize.textContent = formatFileSize(file.size);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove file';
        removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
        removeBtn.addEventListener('click', () => {
            selectedFiles.splice(index, 1);
            updateFileList();
            updateButtons();
        });
        
        fileItem.appendChild(fileName);
        fileItem.appendChild(fileSize);
        fileItem.appendChild(removeBtn);
        fileList.appendChild(fileItem);
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function updateButtons() {
    if (selectedFiles.length > 0) {
        convertBtn.style.display = 'block';
        clearBtn.style.display = 'block';
    } else {
        convertBtn.style.display = 'none';
        clearBtn.style.display = 'none';
    }
}

async function handleConvert() {
    if (selectedFiles.length === 0) return;

    // Check if library is loaded and ready
    if (!libraryReady && typeof heic2any === 'undefined') {
        showMessage('Conversion library not loaded. Please refresh the page and check your internet connection.', 'error');
        return;
    }

    // Wait a bit more if library just loaded
    if (!libraryReady) {
        showMessage('Library is still initializing, please wait...', 'error');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (typeof heic2any === 'undefined') {
            showMessage('Conversion library failed to load. Please refresh the page.', 'error');
            return;
        }
        libraryReady = true;
    }

    // Reset
    convertedFiles = [];
    downloadSection.style.display = 'none';
    convertBtn.disabled = true;
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    hideMessage();

    const totalFiles = selectedFiles.length;
    let completed = 0;
    let hasErrors = false;
    const errorDetails = [];

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            progressText.textContent = `Converting ${i + 1} of ${totalFiles}: ${file.name} (${fileSizeMB} MB)...`;

            try {
                // Verify file type
                if (!isHEICFile(file)) {
                    throw new Error('File does not appear to be a HEIC/HEIF file');
                }
                
                // Mobile-specific: Check if file is actually readable
                if (file.size === 0) {
                    throw new Error('File appears to be empty or corrupted');
                }
                
                // Add timeout for large files (longer timeout on mobile)
                const timeoutDuration = isMobile ? 600000 : 300000; // 10 min mobile, 5 min desktop
                
                // Log file details for debugging (especially on iOS)
                if (isIOS) {
                    console.log('Converting file:', {
                        name: file.name,
                        type: file.type || '(empty)',
                        size: file.size,
                        sizeMB: (file.size / (1024 * 1024)).toFixed(2)
                    });
                }
                
                const conversionPromise = heic2any({
                    blob: file,
                    toType: 'image/jpeg',
                    quality: 0.9
                }).catch(err => {
                    // Log detailed error for debugging
                    console.error('heic2any conversion error:', err);
                    console.error('Error details:', {
                        message: err.message,
                        name: err.name,
                        stack: err.stack,
                        file: file.name,
                        fileType: file.type,
                        fileSize: file.size
                    });
                    
                    // Provide clear, actionable error messages
                    let errorMessage = 'Cannot convert this file';
                    if (err.message) {
                        // Check for specific error patterns
                        const errMsg = err.message.toLowerCase();
                        if (errMsg.includes('worker') || errMsg.includes('web worker')) {
                            errorMessage = 'Cannot convert: Browser compatibility issue. Please try using Chrome or Safari browser.';
                        } else if (errMsg.includes('format') || errMsg.includes('unsupported')) {
                            errorMessage = 'Cannot convert: File format not supported. Please ensure the file is a valid HEIC image.';
                        } else if (errMsg.includes('corrupt') || errMsg.includes('invalid')) {
                            errorMessage = 'Cannot convert: File appears to be corrupted or invalid.';
                        } else {
                            errorMessage = `Cannot convert: ${err.message}`;
                        }
                    } else if (err.toString && err.toString().includes('Worker')) {
                        errorMessage = 'Cannot convert: Browser compatibility issue. Please try using Chrome or Safari browser.';
                    } else if (isMobile) {
                        errorMessage = 'Cannot convert: File conversion failed. The file may be corrupted, too large, or in an unsupported format.';
                    }
                    throw new Error(errorMessage);
                });

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Cannot convert: Conversion timed out. File may be too large or corrupted. Maximum file size is 50MB.')), timeoutDuration);
                });

                const convertedBlob = await Promise.race([conversionPromise, timeoutPromise]);

                // heic2any can return an array or single blob
                let blob;
                if (Array.isArray(convertedBlob)) {
                    blob = convertedBlob[0];
                } else if (convertedBlob instanceof Blob) {
                    blob = convertedBlob;
                } else {
                    throw new Error('Unexpected conversion result format');
                }

                if (!blob || !(blob instanceof Blob)) {
                    throw new Error('Cannot convert: Conversion did not produce a valid image file');
                }
                
                // Verify the blob has content
                if (blob.size === 0) {
                    throw new Error('Cannot convert: Converted file is empty. The original file may be corrupted.');
                }
                
                const convertedFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
                const url = URL.createObjectURL(blob);
                
                convertedFiles.push({
                    name: convertedFileName,
                    blob: blob,
                    url: url
                });

                completed++;
                const progressPercent = Math.round((completed / totalFiles) * 100);
                progressFill.style.width = `${progressPercent}%`;
                
                // Update ARIA progress bar
                const progressBar = document.querySelector('.progress-bar[role="progressbar"]');
                if (progressBar) {
                    progressBar.setAttribute('aria-valuenow', progressPercent);
                }
            } catch (error) {
                hasErrors = true;
                const errorMsg = error.message || 'Unknown error';
                errorDetails.push(`${file.name}: ${errorMsg}`);
                
                // Log error details for debugging
                console.error(`Conversion failed for ${file.name}:`, error);
                console.error('File details:', {
                    name: file.name,
                    type: file.type || '(empty)',
                    size: file.size,
                    detectedAsHEIC: isHEICFile(file)
                });
                
                // Show clear error for this specific file
                const mobileErrorMsg = isMobile 
                    ? `Cannot convert ${file.name}. ${errorMsg.includes('timeout') ? 'File is too large (max 50MB).' : errorMsg.includes('Cannot convert') ? errorMsg : 'Please try a different file or check if the file is a valid HEIC format.'}`
                    : `Cannot convert ${file.name}. ${errorMsg}`;
                showMessage(mobileErrorMsg, 'error');
            }
        }

        if (convertedFiles.length > 0) {
            progressText.textContent = 'Conversion complete!';
            if (hasErrors && convertedFiles.length < totalFiles) {
                showMessage(`Successfully converted ${convertedFiles.length} of ${totalFiles} file(s). Some files failed to convert.`, 'error');
            } else {
                showMessage(`Successfully converted ${convertedFiles.length} file(s)!`, 'success');
            }
            showDownloadSection();
        } else {
            progressText.textContent = 'Conversion failed';
            const failureMsg = isMobile
                ? 'Cannot convert: No files were successfully converted. This may be due to browser compatibility. Please try using Chrome or Safari browser, or convert files one at a time.'
                : 'Cannot convert: No files were successfully converted. Please check that your files are valid HEIC format and try again.';
            showMessage(failureMsg, 'error');
        }
    } catch (error) {
        const errorMsg = isMobile
            ? `An error occurred: ${error.message || 'Unknown error'}. Try refreshing the page or using a different browser.`
            : `An error occurred during conversion: ${error.message || 'Unknown error'}`;
        showMessage(errorMsg, 'error');
    } finally {
        convertBtn.disabled = false;
        setTimeout(() => {
            progressSection.style.display = 'none';
        }, 2000);
    }
}

function showDownloadSection() {
    downloadLinks.innerHTML = '';
    
    convertedFiles.forEach((file, index) => {
        const link = document.createElement('a');
        link.className = 'download-link';
        link.href = file.url;
        link.download = file.name;
        
        const linkText = document.createElement('span');
        linkText.className = 'download-link-text';
        linkText.textContent = file.name;
        
        const icon = document.createElement('span');
        icon.className = 'download-icon';
        icon.innerHTML = '↓';
        icon.setAttribute('aria-hidden', 'true');
        
        link.appendChild(linkText);
        link.appendChild(icon);
        downloadLinks.appendChild(link);
    });
    
    downloadSection.style.display = 'block';
}

function handleDownloadAll() {
    convertedFiles.forEach((file, index) => {
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = file.url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }, index * 200); // Stagger downloads slightly
    });
}

function handleClearAll() {
    // Clean up object URLs before clearing
    convertedFiles.forEach(file => {
        if (file.url) {
            URL.revokeObjectURL(file.url);
        }
    });
    
    selectedFiles = [];
    convertedFiles = [];
    fileInput.value = '';
    fileList.innerHTML = '';
    downloadSection.style.display = 'none';
    progressSection.style.display = 'none';
    updateButtons();
    hideMessage();
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (message.className.includes('success')) {
                hideMessage();
            }
        }, 5000);
    }
}

function hideMessage() {
    message.style.display = 'none';
    message.className = 'message';
}
