<script  lang="ts" setup>
import { ref, onBeforeUnmount } from 'vue';


const fileInput = ref<HTMLInputElement | null>(null);

// 状态
const selectedFile = ref<File | null>(null);
const previewImageUrl = ref<string>('');
const uploadedImageUrl = ref<string>('');
const uploadStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle');
const errorMessage = ref<string>('');

const isDragging = ref<boolean>(false);

// 点击上传区域 -> 触发隐藏的 input
const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

const onClickUpload = (event:any) => {
  const files = event.target.files;
  if (files && files[0]) {
    handleFile(files[0]);
  }
};

// 统一处理文件（无论是点击还是拖拽）
const handleFile = (file:any) => {
  // ========= 1. 类型校验 =========
  if (!file.type.startsWith('image/')) {
    uploadStatus.value = 'error';
    errorMessage.value = '只能上传图片文件，请重新选择。';
    resetPreview();
    return;
  }

  // ========= 2. 大小校验 =========
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    uploadStatus.value = 'error';
    errorMessage.value = '图片大小不能超过 5MB，请重新选择。';
    resetPreview();
    return;
  }

  selectedFile.value = file;
  uploadStatus.value = 'idle';
  errorMessage.value = '';

  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value);
  }

  previewImageUrl.value = URL.createObjectURL(file);
};


// 拖拽进入 / 悬浮
const onDragOver = (event:any) => {
  event.preventDefault();
  isDragging.value = true;
};

const onDragLeave = (event:any) => {
  event.preventDefault();
  isDragging.value = false;
};

const onDrop = (event:any) => {
  event.preventDefault();
  isDragging.value = false;

  const files = event.dataTransfer.files;
  if (files && files[0]) {
    handleFile(files[0]);
  }
};


const uploadImage = async () => {
  if (!selectedFile.value) return;

  try {
    uploadStatus.value = 'uploading';
    errorMessage.value = '';

    const formData = new FormData();
    formData.append('file', selectedFile.value);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });


    if (!res.ok) {
      throw new Error('上传失败');
    }

    const data = await res.json();


    if (!data.url) {
      throw new Error('服务器未返回图片链接');
    }

    uploadedImageUrl.value = data.url;
    uploadStatus.value = 'success';
  } catch (err) {
    console.error(err);
    uploadStatus.value = 'error';
    
    if (err instanceof Error) {
      if (err.message.includes('网络')) {
        errorMessage.value = '网络连接失败，请检查网络后重试';
      } else if (err.message.includes('格式')) {
        errorMessage.value = err.message;
      } else {
        errorMessage.value = `上传失败：${err.message}`;
      }
    } else {
      errorMessage.value = '上传失败，请重试';
    }
  }
};


const resetPreview = () => {
  selectedFile.value = null;

  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value);
  }
  previewImageUrl.value = '';

  uploadedImageUrl.value = '';
  uploadStatus.value = 'idle';
  errorMessage.value = '';
};

// 复制链接
const copyUrl = async (url: string) => {
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    alert('已复制到剪贴板');
  } catch {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    alert('已复制到剪贴板');
  }
};


onBeforeUnmount(() => {
  if (previewImageUrl.value) {
    URL.revokeObjectURL(previewImageUrl.value);
  }
});
</script>

<template>
  <div class="app">
    <div class="background-layer"></div>

    <div class="container">
      <div class="content-wrapper">
        <h1 class="maintitle">我的图床</h1>

        <section class="upload-card">
          <h2>上传图片</h2>

          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            @change="onClickUpload"
            style="display: none;"
          />
          <!-- 上传区域 - 只在无预览时显示 -->
          <div
            v-if="!previewImageUrl"
            class="upload-box"
            :class="{ 'upload-box--dragover': isDragging }"
            @click="triggerFileInput"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
             @drop.prevent="onDrop"
          >
            <div class="upload-content">
              <div class="upload-placeholder">
                  <span>点击或拖拽上传图片</span>
                  <p class="upload-hint">支持拖拽文件到此区域</p>
              </div>
            </div>
          </div>

          <div v-if="previewImageUrl" class="image-preview">
            <h3>图片预览</h3>
            <div class="preview-container">
              <img :src="previewImageUrl" alt="预览的图片" />
            </div>

            <div class="preview-actions">
              <button
                v-if="uploadStatus === 'idle'"
                @click="uploadImage"
                class="upload-btn"
                :disabled="!selectedFile"
              >
                确认上传
              </button>
              <button
                v-if="uploadStatus !== 'success'"
                @click="triggerFileInput"
                class="cancel-btn"
              >
                重新选择
              </button>
              <button
                v-if="uploadStatus === 'success'"
                @click="resetPreview"
                class="upload-btn"
              >
                再来一张
              </button>
            </div>

            <!-- 上传状态显示 -->
            <div v-if="uploadStatus === 'uploading'" class="upload-status uploading">
              <div class="spinner"></div>
              <span>正在上传...</span>
            </div>
            <div v-else-if="uploadStatus === 'success'" class="upload-status success">
              <span>上传成功！</span>
            </div>
            <div v-else-if="uploadStatus === 'error'" class="upload-status error">
              <span>{{ errorMessage }}</span>
              <button @click="uploadImage" class="retry-btn">重试上传</button>
            </div>

            <!-- 显示上传后的图片地址 -->
            <div v-if="uploadedImageUrl" class="image-info">
              <p>图片链接:</p>
              <div class="url-container">
                <input
                  type="text"
                  :value="uploadedImageUrl"
                  readonly
                  class="url-input"
                />
                <button
                  @click="copyUrl(uploadedImageUrl)"
                  class="copy-btn"
                >
                  复制链接
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  height: 100%;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", system-ui, sans-serif;
}

.app {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow: hidden;
}

.background-layer {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at top left, #000000 0%, #1f1e1e 40%, #4b4b4b 100%);
  z-index: 0;
}

.container {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;
  display: flex;
  align-items: center;      
  justify-content: center;  
}

.content-wrapper {
  width: 100%;
  max-width: 900px;
}

.maintitle {
  text-align: center;
  color: #ffffff;
  margin-bottom: 30px;
  font-size: 2.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
}

.upload-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 30px 28px 32px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.2);
  width: 100%;
}

.upload-card h2 {
  margin: 0 0 20px 0;
  color: #111827;
  font-size: 1.6rem;
  font-weight: 600;
}
.upload-box {
  border: 2px dashed #d1d5db;
  border-radius: 14px;
  padding: 50px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
  background: linear-gradient(135deg, #f9fafb 0%, #eff6ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-box--dragover {
  border-color: #2563eb;
  background-color: #e0edff;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  transform: translateY(-1px);
}

.upload-box:hover {
  border-color: #3b82f6;
  background-color: #e5f0ff;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.15);
}

.upload-content {
  pointer-events: none;
}

.upload-placeholder {
  color: #4b5563;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-placeholder span {
  font-size: 18px;
  font-weight: 600;
}

.upload-hint {
  color: #9ca3af;
  font-size: 14px;
}

.image-preview {
  margin-top: 30px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
  width: 100%;
}

.image-preview h3 {
  margin: 0 0 18px 0;
  color: #111827;
  font-size: 1.4rem;
  font-weight: 600;
  text-align: center;
}

.preview-container {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.image-preview img {
  max-width: 100%;
  max-height: 420px;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
  object-fit: contain;
}

.preview-actions {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin: 18px 0 10px;
  flex-wrap: wrap;
}

.upload-btn,
.cancel-btn {
  padding: 11px 26px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s ease;
  min-width: 140px;
}

.upload-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35);
}

.upload-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(16, 185, 129, 0.45);
}

.upload-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  box-shadow: none;
}

.cancel-btn {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(75, 85, 99, 0.3);
}

.cancel-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(55, 65, 81, 0.45);
}

.upload-status {
  text-align: center;
  padding: 16px;
  border-radius: 12px;
  margin: 18px 0;
  font-weight: 500;
  font-size: 14px;
}

.upload-status.uploading {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #1d4ed8;
}

.upload-status.success {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  color: #047857;
}

.upload-status.error {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  color: #b91c1c;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(59, 130, 246, 0.1);
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.retry-btn {
  margin-top: 10px;
  padding: 9px 18px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
}

.retry-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.4);
}

.image-info {
  margin-top: 18px;
  padding: 18px;
  background-color: #f9fafb;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
}

.image-info p {
  margin: 0;
  color: #4b5563;
  font-size: 14px;
  font-weight: 500;
}

.url-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
  margin-top: 10px;
}

.url-input {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-family: "SF Mono", "Monaco", "Consolas", monospace;
  font-size: 13px;
  background-color: #ffffff;
  color: #111827;
  transition: all 0.2s ease;
}

.url-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
}

.copy-btn {
  padding: 10px 18px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
  white-space: nowrap;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
}

.copy-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(37, 99, 235, 0.45);
}

@media (max-width: 1024px) {
  .background-layer {
    display: none;
  }

  .app {
    background-color: #ffffff;
  }

  .container {
    min-height: 100vh;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 20px 0 30px;
    max-width: 100%;
  }

  .content-wrapper {
    max-width: 100%;
  }

  .maintitle {
    color: #111827;
    text-shadow: none;
    margin-bottom: 16px;
    font-size: 2.1rem;
    padding: 0 20px;
  }

  .upload-card {
    border-radius: 0;
    box-shadow: none;
    border: none;
    border-top: 1px solid #e5e7eb;
    width: 100%;
    max-width: 100%;
    padding: 20px 20px 26px;
  }
}

@media (max-width: 768px) {
  .maintitle {
    font-size: 1.9rem;
    padding: 0 18px;
  }

  .upload-card h2 {
    font-size: 1.4rem;
  }

  .upload-box {
    padding: 40px 16px;
  }
}

@media (max-width: 576px) {
  .maintitle {
    font-size: 1.7rem;
    padding: 0 14px;
  }

  .upload-card {
    padding: 18px 16px 24px;
  }

  .preview-actions {
    gap: 10px;
  }

  .upload-btn,
  .cancel-btn {
    min-width: 120px;
    padding: 9px 20px;
    font-size: 14px;
  }
}

@media (prefers-color-scheme: dark) {
  @media (max-width: 1024px) {
    .app {
      background-color: #111827;
    }

    .container {
      background-color: #111827;
    }

    .maintitle {
      color: #f9fafb;
    }

    .upload-card {
      background-color: #111827;
      border-top: 1px solid #111827;
    }

    .upload-card h2,
    .image-preview h3,
    .image-info p {
      color: #e5e7eb;
    }

    .upload-box {
      background: linear-gradient(135deg, #111827 0%, #020617 100%);
      border-color: #374151;
    }

    .upload-placeholder span {
      color: #e5e7eb;
    }

    .upload-hint {
      color: #9ca3af;
    }

    .image-info {
      background-color: #020617;
      border-color: #1f2937;
    }

    .url-input {
      background-color: #020617;
      border-color: #374151;
      color: #e5e7eb;
    }
  }
}
</style>

