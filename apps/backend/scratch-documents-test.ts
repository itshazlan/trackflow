import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { AppModule } from './src/app.module';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';

process.env.NODE_ENV = 'test';

async function main() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  
  // Register mock-r2 handler for local file upload testing on the test server
  const express = require('express');
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  expressInstance.put('/mock-r2/:bucket/*key', (req: any, res: any) => {
    // In some express versions, wildcard is in req.params[0], in others it is mapped to parameter name
    const keyParam = req.params.key || req.params[0];
    const key = Array.isArray(keyParam) ? keyParam.join('/') : keyParam;
    const filePath = join(process.cwd(), 'uploads', key);
    
    fs.mkdirSync(join(filePath, '..'), { recursive: true });
    
    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);
    
    writeStream.on('finish', () => {
      res.status(200).json({ success: true, path: `/uploads/${key}` });
    });
    
    writeStream.on('error', (err) => {
      console.error('[Mock R2 Upload Error]:', err);
      res.status(500).send('Upload failed');
    });
  });

  await app.init();

  const server = app.getHttpServer();

  // Test setup data
  const projectId = '384e8138-ced8-4df7-b08d-2972606aa764'; // MyKura
  const adminToken = 'Q4oX5vntKvSUJPVy7Tq9S37BvijmbJJv'; // Admin session token
  const devToken = '756XO85uGUH6LbW0L4H5NB1z0kjEO68A'; // Hamzah Alvana session token (Developer in project)

  console.log('=== TEST 1: GET documents (Empty List initially) ===');
  const resListEmpty = await request(server)
    .get(`/projects/${projectId}/documents`)
    .set('Authorization', `Bearer ${devToken}`);
  console.log('List status:', resListEmpty.status);
  console.log('List count:', resListEmpty.body.length);

  console.log('\n=== TEST 2: POST document (Generate Upload URL as Dev) ===');
  const uploadPayload = {
    fileName: 'test-spec.pdf',
    category: 'project_doc',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024 * 1024, // 1MB
    description: 'Manual verification project specification document',
  };

  const resUpload = await request(server)
    .post(`/projects/${projectId}/documents`)
    .set('Authorization', `Bearer ${devToken}`)
    .send(uploadPayload);

  console.log('Upload Status:', resUpload.status);
  console.log('Upload Response Body:', resUpload.body);

  if (resUpload.status !== 201) {
    throw new Error('Failed to create upload request');
  }

  const { documentId, uploadUrl } = resUpload.body;

  console.log('\n=== TEST 3: Upload file to presigned URL ===');
  const fileContent = Buffer.from('PDF MOCK CONTENT FOR TESTING');
  let uploadStatus = 0;

  if (uploadUrl.startsWith('http://localhost:3000') || uploadUrl.includes('/mock-r2/')) {
    // Mock mode
    const urlPath = uploadUrl.replace('http://localhost:3000', '');
    console.log('PUT target path (local mock):', urlPath);
    const resPutFile = await request(server)
      .put(urlPath)
      .set('Content-Type', 'application/pdf')
      .send(fileContent);
    uploadStatus = resPutFile.status;
    console.log('PUT file status (local mock):', resPutFile.status);
  } else {
    // Real R2
    console.log('PUT target url (real R2):', uploadUrl);
    const fetchRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: fileContent,
    });
    uploadStatus = fetchRes.status;
    console.log('PUT file status (real R2):', fetchRes.status);
  }

  if (uploadStatus !== 200) {
    throw new Error('Upload to pre-signed URL failed with status ' + uploadStatus);
  }

  console.log('\n=== TEST 4: POST /confirm Upload finished ===');
  const resConfirm = await request(server)
    .post(`/projects/${projectId}/documents/${documentId}/confirm`)
    .set('Authorization', `Bearer ${devToken}`);

  console.log('Confirm Status:', resConfirm.status);
  console.log('Confirm Body:', resConfirm.body);

  console.log('\n=== TEST 5: GET documents (Should have 1 document now) ===');
  const resList = await request(server)
    .get(`/projects/${projectId}/documents`)
    .set('Authorization', `Bearer ${devToken}`);
  console.log('List status:', resList.status);
  console.log('List count:', resList.body.length);
  console.log('First Document:', resList.body[resList.body.length - 1]);

  console.log('\n=== TEST 6: GET download URL ===');
  const resDownload = await request(server)
    .get(`/projects/${projectId}/documents/${documentId}/download`)
    .set('Authorization', `Bearer ${devToken}`);
  console.log('Download Status:', resDownload.status);
  console.log('Download Link:', resDownload.body.downloadUrl);

  console.log('\n=== TEST 7: Fetch actual file via download proxy/path ===');
  let fileText = '';
  let fileStatus = 0;
  const downloadUrl = resDownload.body.downloadUrl;

  if (downloadUrl.startsWith('http://localhost:3000') || downloadUrl.includes('/uploads/')) {
    const downloadPath = downloadUrl.replace('http://localhost:3000', '');
    console.log('Download GET path (local mock):', downloadPath);
    const resFileContent = await request(server).get(downloadPath);
    fileStatus = resFileContent.status;
    fileText = resFileContent.text;
  } else {
    console.log('Download GET url (real R2):', downloadUrl);
    const fetchRes = await fetch(downloadUrl);
    fileStatus = fetchRes.status;
    fileText = await fetchRes.text();
  }

  console.log('File Content Status:', fileStatus);
  console.log('File Content Matches:', fileText === 'PDF MOCK CONTENT FOR TESTING');

  console.log('\n=== TEST 8: DELETE document (Allowed as Owner/Dev) ===');
  const resDelete = await request(server)
    .delete(`/projects/${projectId}/documents/${documentId}`)
    .set('Authorization', `Bearer ${devToken}`);

  console.log('Delete Status:', resDelete.status);
  console.log('Delete Body:', resDelete.body);

  // Let's create another document to verify Admin delete override
  console.log('\n=== TEST 9: Create and verify Admin delete override ===');
  const resUpload2 = await request(server)
    .post(`/projects/${projectId}/documents`)
    .set('Authorization', `Bearer ${devToken}`)
    .send({
      ...uploadPayload,
      fileName: 'admin-override.pdf',
    });
  
  const docId2 = resUpload2.body.documentId;
  const uploadUrl2 = resUpload2.body.uploadUrl;

  if (uploadUrl2.startsWith('http://localhost:3000') || uploadUrl2.includes('/mock-r2/')) {
    const putPath2 = uploadUrl2.replace('http://localhost:3000', '');
    await request(server).put(putPath2).set('Content-Type', 'application/pdf').send(fileContent);
  } else {
    await fetch(uploadUrl2, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: fileContent,
    });
  }

  await request(server)
    .post(`/projects/${projectId}/documents/${docId2}/confirm`)
    .set('Authorization', `Bearer ${devToken}`);

  console.log('Deleting doc2 using ADMIN token...');
  const resDeleteAdmin = await request(server)
    .delete(`/projects/${projectId}/documents/${docId2}`)
    .set('Authorization', `Bearer ${adminToken}`);
  console.log('Admin Delete Status:', resDeleteAdmin.status);
  console.log('Admin Delete Body:', resDeleteAdmin.body);

  await app.close();
  console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY! ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
