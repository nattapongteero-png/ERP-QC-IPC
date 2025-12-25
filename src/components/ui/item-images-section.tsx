'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DxButton } from '@/components/ui/dx-button';
import { DxTextBox } from '@/components/ui/dx-text-box';
import { cn } from '@/lib/utils/cn';
import {
  ImageIcon,
  Upload,
  Trash2,
  Star,
  StarOff,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ZoomIn,
} from 'lucide-react';
import { DxPopup } from '@/components/ui/dx-popup';

// ============================================================================
// Types
// ============================================================================

interface ItemImage {
  id: number;
  itemId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isPrimary: boolean;
  sortOrder: number;
  description: string | null;
  createdAt: string;
  imageUrl: string;
  thumbnailUrl: string;
}

interface ItemImagesSectionProps {
  itemId: number;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchItemImages(itemId: number): Promise<ItemImage[]> {
  const response = await fetch(`/api/items/${itemId}/images`);
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch images');
  }
  return result.data;
}

async function uploadImage(
  itemId: number,
  file: File,
  description: string,
  isPrimary: boolean
): Promise<ItemImage> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('description', description);
  formData.append('isPrimary', isPrimary.toString());

  const response = await fetch(`/api/items/${itemId}/images`, {
    method: 'POST',
    body: formData,
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to upload image');
  }
  return result.data;
}

async function deleteImage(itemId: number, imageId: number): Promise<void> {
  const response = await fetch(`/api/items/${itemId}/images?imageId=${imageId}`, {
    method: 'DELETE',
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete image');
  }
}

async function updateImage(
  itemId: number,
  imageId: number,
  data: { isPrimary?: boolean; description?: string }
): Promise<void> {
  const response = await fetch(`/api/items/${itemId}/images`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageId, ...data }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to update image');
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ItemImagesSection({ itemId, className }: ItemImagesSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showUploadDialog, setShowUploadDialog] = React.useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [selectedImage, setSelectedImage] = React.useState<ItemImage | null>(null);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = React.useState('');
  const [uploadAsPrimary, setUploadAsPrimary] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);

  // Fetch images
  const { data: images = [], isLoading, error } = useQuery({
    queryKey: ['item-images', itemId],
    queryFn: () => fetchItemImages(itemId),
    enabled: !!itemId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, description, isPrimary }: { file: File; description: string; isPrimary: boolean }) =>
      uploadImage(itemId, file, description, isPrimary),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-images', itemId] });
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadDescription('');
      setUploadAsPrimary(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (imageId: number) => deleteImage(itemId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-images', itemId] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ imageId, data }: { imageId: number; data: { isPrimary?: boolean; description?: string } }) =>
      updateImage(itemId, imageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-images', itemId] });
    },
  });

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setShowUploadDialog(true);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadFile(file);
      setShowUploadDialog(true);
    }
  };

  // Handle upload
  const handleUpload = () => {
    if (!uploadFile) return;
    uploadMutation.mutate({
      file: uploadFile,
      description: uploadDescription,
      isPrimary: uploadAsPrimary,
    });
  };

  // Handle delete
  const handleDelete = (image: ItemImage) => {
    if (confirm(`Are you sure you want to delete "${image.fileName}"?`)) {
      deleteMutation.mutate(image.id);
    }
  };

  // Handle set primary
  const handleSetPrimary = (image: ItemImage) => {
    updateMutation.mutate({ imageId: image.id, data: { isPrimary: true } });
  };

  // Handle preview
  const handlePreview = (image: ItemImage) => {
    setSelectedImage(image);
    setShowPreviewDialog(true);
  };

  const primaryImage = images.find(img => img.isPrimary);
  const otherImages = images.filter(img => !img.isPrimary);

  return (
    <div className={cn('rounded-2xl border border-gray-200 bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-white border border-gray-200">
          <ImageIcon className="h-5 w-5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">รูปภาพสินค้า</h3>
          <p className="text-xs text-gray-500 mt-0.5">{images.length} รูป</p>
        </div>
        <DxButton
          text="อัปโหลด"
          icon="upload"
          type="default"
          stylingMode="outlined"
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Content */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm">Failed to load images</span>
          </div>
        ) : images.length === 0 ? (
          // Empty state with drag & drop
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">ลากไฟล์มาวางที่นี่</p>
            <p className="text-xs text-gray-500 mb-4">หรือคลิกเพื่อเลือกไฟล์</p>
            <DxButton
              text="เลือกรูปภาพ"
              icon="image"
              type="default"
              stylingMode="contained"
              onClick={() => fileInputRef.current?.click()}
            />
            <p className="text-xs text-gray-400 mt-3">รองรับ JPEG, PNG, GIF, WebP (สูงสุด 5MB)</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Primary Image */}
            {primaryImage && (
              <div className="relative">
                <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden">
                  <img
                    src={primaryImage.imageUrl}
                    alt={primaryImage.fileName}
                    className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => handlePreview(primaryImage)}
                  />
                </div>
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-xs font-medium rounded-full">
                  <Star className="h-3 w-3" />
                  รูปหลัก
                </div>
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <button
                    onClick={() => handlePreview(primaryImage)}
                    className="p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm transition-colors"
                    title="ดูรูปขยาย"
                  >
                    <ZoomIn className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(primaryImage)}
                    className="p-1.5 bg-white/90 hover:bg-red-50 rounded-lg shadow-sm transition-colors"
                    title="ลบรูป"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </div>
            )}

            {/* Other Images Grid */}
            {otherImages.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {otherImages.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={image.thumbnailUrl}
                        alt={image.fileName}
                        className="w-full h-full object-cover cursor-pointer group-hover:opacity-90 transition-opacity"
                        onClick={() => handlePreview(image)}
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSetPrimary(image)}
                          className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-amber-50 transition-colors"
                          title="ตั้งเป็นรูปหลัก"
                        >
                          <StarOff className="h-4 w-4 text-amber-500" />
                        </button>
                        <button
                          onClick={() => handlePreview(image)}
                          className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                          title="ดูรูปขยาย"
                        >
                          <ZoomIn className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(image)}
                          className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                          title="ลบรูป"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add More Button */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer',
                dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">เพิ่มรูปภาพ</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <DxPopup
        visible={showUploadDialog}
        onHiding={() => {
          setShowUploadDialog(false);
          setUploadFile(null);
          setUploadDescription('');
          setUploadAsPrimary(false);
        }}
        title="อัปโหลดรูปภาพ"
        showCloseButton
        width={500}
        height="auto"
      >
        <div className="p-4 space-y-4">
          {/* Preview */}
          {uploadFile && (
            <div className="relative aspect-video bg-gray-100 rounded-xl overflow-hidden">
              <img
                src={URL.createObjectURL(uploadFile)}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* File Info */}
          {uploadFile && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <ImageIcon className="h-5 w-5 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{uploadFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
              </div>
              <button
                onClick={() => setUploadFile(null)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย (ไม่บังคับ)</label>
            <DxTextBox
              value={uploadDescription}
              onValueChange={setUploadDescription}
              placeholder="เช่น รูปด้านหน้าผลิตภัณฑ์"
            />
          </div>

          {/* Set as Primary */}
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={uploadAsPrimary}
              onChange={(e) => setUploadAsPrimary(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-700">ตั้งเป็นรูปหลัก</span>
            </div>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <DxButton
              text="ยกเลิก"
              type="normal"
              stylingMode="outlined"
              onClick={() => {
                setShowUploadDialog(false);
                setUploadFile(null);
              }}
            />
            <DxButton
              text={uploadMutation.isPending ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
              icon="upload"
              type="success"
              onClick={handleUpload}
              disabled={!uploadFile || uploadMutation.isPending}
            />
          </div>
        </div>
      </DxPopup>

      {/* Preview Dialog */}
      <DxPopup
        visible={showPreviewDialog}
        onHiding={() => {
          setShowPreviewDialog(false);
          setSelectedImage(null);
        }}
        title={selectedImage?.fileName || 'รูปภาพ'}
        showCloseButton
        width="80%"
        height="80%"
      >
        {selectedImage && (
          <div className="h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center bg-gray-900 rounded-lg overflow-hidden">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.fileName}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="p-4 flex items-center justify-between bg-gray-50 border-t">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">
                  {formatFileSize(selectedImage.fileSize)}
                </span>
                {selectedImage.isPrimary && (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    <Star className="h-3 w-3" />
                    รูปหลัก
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!selectedImage.isPrimary && (
                  <DxButton
                    text="ตั้งเป็นรูปหลัก"
                    icon="favorites"
                    type="default"
                    stylingMode="outlined"
                    onClick={() => {
                      handleSetPrimary(selectedImage);
                      setShowPreviewDialog(false);
                    }}
                  />
                )}
                <DxButton
                  text="ลบรูปภาพ"
                  icon="trash"
                  type="danger"
                  stylingMode="outlined"
                  onClick={() => {
                    handleDelete(selectedImage);
                    setShowPreviewDialog(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </DxPopup>
    </div>
  );
}

export default ItemImagesSection;
