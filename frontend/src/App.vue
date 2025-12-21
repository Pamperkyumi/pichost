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

    <main class="container" main-content>
      <div class="content-wrapper">
        <h1 class="maintitle">Pamperのimagehosting</h1>

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
    </main>
    <footer class="site-footer" role="contentinfo">
      <div class="footer-inner">
        <div class="footer-left">
          <span class="footer-item">© {{ new Date().getFullYear() }} pichost</span>
          <span class="footer-sep">•</span>
          <a href="https://icp.gov.moe/?keyword=20250435" target="_blank">萌ICP备20250435号</a>
        </div>

        <div class="footer-right">
          <a class="footer-link" href="/privacy">隐私政策</a>
          <span class="footer-sep">•</span>
          <a class="footer-link" href="/terms">使用条款</a>
        </div>
      </div>
    </footer>
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
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", system-ui, sans-serif;
}

.app {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
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
  flex: 1;
  width: 100%;
  padding: 40px 20px;
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
.site-footer {
  position: relative;
  width: 100%;
  margin-top: auto;
  padding: 14px 16px 18px;
}


.footer-inner {
  max-width: 980px;
  margin: 0 auto;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);

  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.footer-left,
.footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.footer-item {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
}

.footer-sep {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  user-select: none;
}

.footer-link {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.72);
  text-decoration: none;
  transition: color 0.2s ease, opacity 0.2s ease;
}

.footer-link:hover {
  color: rgba(0, 0, 0, 0.9);
  opacity: 0.95;
  text-decoration: underline;
}

.footer-link:active {
  opacity: 0.8;
}


@media (max-width: 640px) {
  .footer-inner {
    flex-direction: column;
    align-items: flex-start;
  }

  .footer-right {
    opacity: 0.9;
  }
}


/* =========================
   Responsive (smoothed)
   ========================= */

/* 1) <=1024：不要“翻面”，只做柔和收敛 */
@media (max-width: 1024px) {
  .background-layer {
    /* 不要直接 display:none; 改为弱化，避免风格突变 */
    display: block;
    opacity: 0.45;
    filter: blur(2px);
    transform: scale(1.03);
  }

  .app {
    /* 仍然保持整体深色氛围（桌面一致），避免变白突兀 */
    background-color: transparent;
  }

  .container {
    min-height: 100vh;
    align-items: center;
    justify-content: center;
    padding: 28px 18px;
    max-width: 100%;
  }

  .content-wrapper {
    max-width: 720px;
  }

  .maintitle {
    /* 字号不要跳太多 */
    font-size: 2.2rem;
    margin-bottom: 20px;
    padding: 0 8px;
    color: #ffffff;
    text-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
  }

  .upload-card {
    /* 保留卡片感，只是更“紧凑” */
    border-radius: 18px;
    padding: 24px 20px 26px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.22);
    background: rgba(255, 255, 255, 0.96);
  }

  .upload-box {
    padding: 44px 16px;
  }

  .image-preview img {
    max-height: 360px;
  }

  .site-footer {
    margin-top: 22px;
  }

  .footer-inner {
    max-width: 720px;
  }
}

/* 2) <=768：继续收敛布局和控件尺寸（小步变化） */
@media (max-width: 768px) {
  .background-layer {
    opacity: 0.38;
    filter: blur(2.5px);
  }

  .container {
    padding: 22px 14px;
  }

  .content-wrapper {
    max-width: 620px;
  }

  .maintitle {
    font-size: 2.0rem;
    margin-bottom: 16px;
    letter-spacing: 0.06em;
  }

  .upload-card h2 {
    font-size: 1.45rem;
    margin-bottom: 16px;
  }

  .upload-card {
    border-radius: 16px;
    padding: 20px 16px 22px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.20);
  }

  .upload-box {
    padding: 38px 14px;
    border-radius: 12px;
  }

  .upload-placeholder span {
    font-size: 16px;
  }

  .upload-hint {
    font-size: 13px;
  }

  .image-preview {
    margin-top: 22px;
    padding-top: 18px;
  }

  .image-preview img {
    max-height: 320px;
    border-radius: 12px;
  }

  .preview-actions {
    gap: 10px;
  }

  .upload-btn,
  .cancel-btn {
    min-width: 128px;
    padding: 10px 20px;
    font-size: 14px;
  }

  .footer-inner {
    border-radius: 12px;
    padding: 12px 14px;
  }
}

/* 3) <=576：真正移动端（仍保持“同款卡片”，但更轻更紧凑） */
@media (max-width: 576px) {
  .background-layer {
    opacity: 0.32;
    filter: blur(3px);
  }
  .main-content {
    padding-top: 18px
  }

  .container {
    justify-content: flex-start;
    padding: 18px 12px 16px;
  }

  .content-wrapper {
    width: 100%;
  }

   .maintitle {
    margin-top: 10px;
    margin-bottom: 16px;
    font-size: 1.7rem;
  }

  .upload-card {
    margin-top: 10px;
    border-radius: 14px;
    padding: 16px 14px 18px;
  }

  .upload-card h2 {
    font-size: 1.3rem;
  }

  .upload-box {
    padding: 32px 12px;
  }

  .image-preview h3 {
    font-size: 1.2rem;
  }

  .preview-actions {
    gap: 8px;
  }

  .upload-btn,
  .cancel-btn {
    min-width: 120px;
    padding: 9px 18px;
    font-size: 14px;
  }

  .url-input {
    min-width: 160px;
    font-size: 12px;
    padding: 9px 12px;
  }

  .copy-btn {
    padding: 9px 14px;
    font-size: 12px;
  }
  .site-footer{
    padding: 12px 12px 16px;
  }

  .footer-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}

/* 4) 深色模式：别只在 <=1024 才生效，移动端也保持一致风格 */
@media (prefers-color-scheme: dark) {
  @media (max-width: 1024px) {
    .app {
      background-color: transparent;
    }

    .upload-card {
      background: rgba(17, 24, 39, 0.92);
      border-color: rgba(255, 255, 255, 0.10);
    }

    .upload-card h2,
    .image-preview h3,
    .image-info p {
      color: #e5e7eb;
    }

    .upload-box {
      background: linear-gradient(135deg, rgba(17, 24, 39, 0.92) 0%, rgba(2, 6, 23, 0.92) 100%);
      border-color: rgba(55, 65, 81, 0.9);
    }

    .upload-placeholder span {
      color: #e5e7eb;
    }

    .upload-hint {
      color: #9ca3af;
    }

    .image-info {
      background-color: rgba(2, 6, 23, 0.85);
      border-color: rgba(31, 41, 55, 0.9);
    }

    .url-input {
      background-color: rgba(2, 6, 23, 0.85);
      border-color: rgba(55, 65, 81, 0.9);
      color: #e5e7eb;
    }

    .footer-inner {
      background: rgba(17, 24, 39, 0.65);
      border-color: rgba(255, 255, 255, 0.08);
    }

    .footer-item,
    .footer-link {
      color: rgba(229, 231, 235, 0.85);
    }

    .footer-sep {
      color: rgba(229, 231, 235, 0.35);
    }
  }
}
</style>

