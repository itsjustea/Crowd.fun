// frontend/lib/ipfs.ts
export interface CampaignUpdate {
  title: string;
  content: string;
  images?: string[];
  timestamp: number;
  author: string;
}

export async function uploadUpdateToIPFS(update: CampaignUpdate): Promise<string> {
  try {
    const blob = new Blob([JSON.stringify(update)], { type: 'application/json' });
    const file = new File([blob], 'update.json', { type: 'application/json' });
    
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    });
    
     // ✅ Better error handling
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }


    const data = await response.json();
    return data.cid;
  } catch (error) {
    console.error('IPFS upload error:', error);
    throw new Error('Failed to upload to IPFS');
  }
}

export async function uploadImageToIPFS(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    });
    
    // ✅ Better error handling
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Image upload failed:', response.status, errorText);
      throw new Error(`Image upload failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.cid;
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image');
  }
}

export async function fetchUpdateFromIPFS(ipfsHash: string): Promise<CampaignUpdate> {
  try {
    console.log('🔍 Fetching update from IPFS:', ipfsHash);
    
    const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    console.log('📡 Fetching from URL:', url);
    
    const response = await fetch(url);
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Response error:', errorText);
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Fetched data:', data);
    
    return data;
  } catch (error) {
    console.error('❌ IPFS fetch error:', error);
    throw new Error('Failed to fetch from IPFS');
  }
}
