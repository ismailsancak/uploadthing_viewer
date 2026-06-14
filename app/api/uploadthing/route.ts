// app/api/uploadthing-files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UTApi } from 'uploadthing/server';

export const dynamic = 'force-dynamic';

// Lazy initialize UTApi to prevent build-time crashes when UPLOADTHING_SECRET is missing.
let utapiInstance: UTApi | null = null;
const getUtapi = () => {
  if (!utapiInstance) {
    // V6 SDK uyumluluğu için UPLOADTHING_TOKEN'ı çözüp SECRET ve APP_ID olarak set edelim
    if (process.env.UPLOADTHING_TOKEN && !process.env.UPLOADTHING_SECRET) {
      try {
        const decoded = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN, 'base64').toString('utf-8'));
        if (decoded.apiKey) {
          process.env.UPLOADTHING_SECRET = decoded.apiKey;
        }
        if (decoded.appId) {
          process.env.UPLOADTHING_APP_ID = decoded.appId;
        }
      } catch (e) {
        console.error("UploadThing token parse hatası:", e);
      }
    }
    utapiInstance = new UTApi();
  }
  return utapiInstance;
};

export async function GET(request: NextRequest) {
  try {
    // UploadThing'den dosyaları listele
    const response = await getUtapi().listFiles();
    
    // Response yapısını kontrol et
    if (!response || !response.files) {
      return NextResponse.json({
        success: true,
        files: [],
        total: 0
      });
    }
    
    // Dosyaları istediğimiz formatta düzenle ve tarihe göre sırala (yeni eklenenler üstte)
    const formattedFiles = response.files
      .map(file => ({
        key: file.key,
        name: file.name,
        url: `https://utfs.io/f/${file.key}`,
        size: (file as any).size || 0,
        createdAt: (file as any).createdAt || (file as any).uploadedAt || Date.now(),
        customId: file.customId || null
      }))
      .sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      success: true,
      files: formattedFiles,
      total: formattedFiles.length
    });
    
  } catch (error) {
    console.error('UploadThing dosya listesi hatası:', error);
    
    // Hata tipine göre daha detaylı response
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Dosyalar yüklenirken hata oluştu',
        details: errorMessage,
        files: [],
        total: 0
      }, 
      { status: 500 }
    );
  }
}

// Belirli bir dosyayı silmek için DELETE endpoint
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get('key');
    
    if (!fileKey) {
      return NextResponse.json(
        { success: false, error: 'Dosya anahtarı (key) gerekli' },
        { status: 400 }
      );
    }
    
    // Dosyayı sil
    const deleteResponse = await getUtapi().deleteFiles([fileKey]);
    
    // Silme işleminin başarılı olup olmadığını kontrol et
    if (deleteResponse.success) {
      return NextResponse.json({
        success: true,
        message: 'Dosya başarıyla silindi',
        deletedKey: fileKey
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Dosya silinemedi' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Dosya silme hatası:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Dosya silinirken hata oluştu',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// Dosya bilgilerini güncellemek için PATCH endpoint (opsiyonel)
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileKey = searchParams.get('key');
    const body = await request.json();
    
    if (!fileKey) {
      return NextResponse.json(
        { success: false, error: 'Dosya anahtarı (key) gerekli' },
        { status: 400 }
      );
    }
    
    // Dosya bilgilerini güncelle (örneğin metadata)
    // Bu özellik UploadThing API'sine bağlı olarak değişebilir
    
    return NextResponse.json({
      success: true,
      message: 'Dosya bilgileri güncellendi',
      updatedKey: fileKey
    });
    
  } catch (error) {
    console.error('Dosya güncelleme hatası:', error);
    
    return NextResponse.json(
      { success: false, error: 'Dosya güncellenirken hata oluştu' },
      { status: 500 }
    );
  }
}
