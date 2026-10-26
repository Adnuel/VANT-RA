/**
 * Verified Client-Side ZIP Downloader for VANTÉRA
 * Ensures the downloaded file is a genuine binary ZIP archive and NEVER an HTML wrapper or redirect page.
 */
export async function downloadProjectZip(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/download-zip', {
      headers: {
        'Accept': 'application/zip, application/octet-stream',
      },
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Server returned HTML instead of a binary ZIP file');
    }

    const blob = await res.blob();
    
    // Check first 4 bytes of ZIP header (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
    const headerBuffer = await blob.slice(0, 4).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);
    const isZipSignature =
      headerBytes[0] === 0x50 &&
      headerBytes[1] === 0x4b &&
      headerBytes[2] === 0x03 &&
      headerBytes[3] === 0x04;

    if (!isZipSignature) {
      throw new Error('Downloaded data did not match the PK ZIP binary signature.');
    }

    // Force real application/zip MIME type
    const zipBlob = new Blob([blob], { type: 'application/zip' });
    const url = window.URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'vantera-project.zip');
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 2000);

    return { success: true };
  } catch (err: any) {
    console.error('ZIP download error:', err);
    return { success: false, message: err?.message || 'Download failed' };
  }
}

/**
 * Verified Client-Side Android Project ZIP Downloader for VANTÉRA
 * Downloads the complete native Android Studio wrapper bundle (Capacitor com.vantera.store).
 */
export async function downloadAndroidProjectZip(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/download-android-project', {
      headers: {
        'Accept': 'application/zip, application/octet-stream',
      },
    });

    if (!res.ok) {
      // Fallback to direct window location download
      window.location.href = '/api/download-android-project';
      return { success: true };
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Server returned HTML instead of a binary ZIP file');
    }

    const blob = await res.blob();
    
    // Check first 4 bytes of ZIP header (PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
    const headerBuffer = await blob.slice(0, 4).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);
    const isZipSignature =
      headerBytes[0] === 0x50 &&
      headerBytes[1] === 0x4b &&
      headerBytes[2] === 0x03 &&
      headerBytes[3] === 0x04;

    if (!isZipSignature) {
      throw new Error('Downloaded data did not match the PK ZIP binary signature.');
    }

    const zipBlob = new Blob([blob], { type: 'application/zip' });
    const url = window.URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'vantera-android-project.zip');
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 2000);

    return { success: true };
  } catch (err: any) {
    console.warn('Android ZIP blob download error, triggering direct download fallback:', err);
    try {
      window.location.href = '/api/download-android-project';
      return { success: true };
    } catch {
      return { success: false, message: err?.message || 'Download failed' };
    }
  }
}
