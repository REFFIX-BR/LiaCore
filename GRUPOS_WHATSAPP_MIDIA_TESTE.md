# Teste de Envio de Mídias para Grupos WhatsApp

## ✅ Implementação Completa

### Backend (server/workers.ts)
- ✅ Função `sendWhatsAppMedia()` criada
- ✅ Suporte para 3 tipos de mídia: image, document, audio
- ✅ Integração com Evolution API (/message/sendMedia/{instance})
- ✅ Conversão automática de base64 para mídia
- ✅ Suporte a legendas (caption) opcionais

### API (server/routes.ts)
- ✅ Endpoint POST `/api/groups/:id/send-media`
- ✅ Validação de tipo de mídia (image | document | audio)
- ✅ Armazenamento correto usando campos do schema:
  - `imageBase64` para imagens
  - `pdfBase64` + `pdfName` para documentos
  - `audioBase64` para áudio
- ✅ Atualização do lastMessage da conversa
- ✅ Invalidação do cache Redis

### Frontend (client/src/pages/Groups.tsx)
- ✅ Botão anexar (📎) com ícone Paperclip
- ✅ Input de arquivo oculto
- ✅ Preview visual para imagens
- ✅ Ícones para documentos (FileText) e áudio (Mic)
- ✅ Campo de legenda opcional
- ✅ Indicador de tamanho de arquivo
- ✅ Botão remover anexo (X)
- ✅ Validação de tipos de arquivo
- ✅ Limite de tamanho: 10MB (imagem/documento), 16MB (áudio)
- ✅ Conversão automática para base64
- ✅ Estado de loading durante envio
- ✅ Feedback de sucesso/erro via toast

## 📋 Casos de Teste

### Teste 1: Enviar Imagem
1. Acessar página de Grupos
2. Selecionar um grupo
3. Clicar no botão anexar (📎)
4. Selecionar arquivo de imagem (JPG, PNG, GIF, WebP)
5. Verificar preview da imagem (16x16 rounded)
6. Adicionar legenda opcional
7. Clicar em enviar
8. **Resultado esperado**: 
   - Imagem enviada via Evolution API
   - Mensagem salva no banco com `imageBase64`
   - Preview limpo após envio
   - Toast de sucesso exibido

### Teste 2: Enviar Documento PDF
1. Acessar página de Grupos
2. Selecionar um grupo
3. Clicar no botão anexar (📎)
4. Selecionar arquivo PDF
5. Verificar ícone de documento (FileText)
6. Adicionar legenda "Contrato anexado"
7. Clicar em enviar
8. **Resultado esperado**: 
   - PDF enviado via Evolution API
   - Mensagem salva com `pdfBase64` e `pdfName`
   - Legenda "Contrato anexado" incluída
   - Toast de sucesso exibido

### Teste 3: Enviar Áudio
1. Acessar página de Grupos
2. Selecionar um grupo
3. Clicar no botão anexar (📎)
4. Selecionar arquivo de áudio (MP3, WAV, OGG)
5. Verificar ícone de áudio (Mic)
6. Clicar em enviar (sem legenda)
7. **Resultado esperado**: 
   - Áudio enviado via Evolution API
   - Mensagem salva com `audioBase64`
   - Toast de sucesso exibido

### Teste 4: Validação de Tipo de Arquivo
1. Tentar anexar arquivo .txt ou .exe
2. **Resultado esperado**: 
   - Toast de erro: "Tipo de arquivo inválido"
   - Lista de formatos aceitos exibida

### Teste 5: Validação de Tamanho
1. Tentar anexar imagem > 10MB
2. **Resultado esperado**: 
   - Toast de erro: "Arquivo muito grande"
   - Limite máximo exibido

### Teste 6: Remover Anexo
1. Anexar uma imagem
2. Adicionar legenda
3. Clicar no botão X (remover)
4. **Resultado esperado**: 
   - Preview removido
   - Legenda limpa
   - Input de arquivo resetado

### Teste 7: Enter para Enviar
1. Anexar arquivo
2. Pressionar Enter
3. **Resultado esperado**: 
   - Mídia enviada automaticamente

## 🔧 Detalhes Técnicos

### Formatos Aceitos
- **Imagens**: image/jpeg, image/jpg, image/png, image/gif, image/webp
- **Documentos**: application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
- **Áudio**: audio/mpeg, audio/mp3, audio/wav, audio/ogg, audio/m4a

### Limites
- Imagens/Documentos: 10MB
- Áudio: 16MB

### Evolution API Endpoint
```
POST /message/sendMedia/{instance}
Content-Type: application/json

{
  "number": "5524992534131-1234567890@g.us",
  "mediatype": "image",  // ou "document", "audio"
  "mimetype": "image/jpeg",
  "caption": "Legenda opcional",
  "fileName": "imagem.jpg",
  "media": "base64string..."
}
```

### Estados no Frontend
- `attachedFile`: File | null - Arquivo selecionado
- `filePreview`: string | null - URL de preview (data:image/...)
- `caption`: string - Texto da legenda
- `fileInputRef`: Ref do input oculto

### Fluxo de Dados
1. Usuário seleciona arquivo → `handleFileSelect()`
2. Validação de tipo e tamanho
3. Conversão para preview (somente imagens)
4. Usuário clica enviar → `handleSendMedia()`
5. Conversão para base64 via FileReader
6. POST para `/api/groups/:id/send-media`
7. Backend salva no DB e envia via Evolution API
8. Cleanup: limpa estados, invalida cache, mostra toast
