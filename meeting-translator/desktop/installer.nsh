!macro customInstall
  CreateDirectory "$SMPROGRAMS\Meeting Translator"
  IfFileExists "$INSTDIR\resources\runtime\vbcable\Install-VB-Cable.bat" 0 vb_no_shortcut
    CreateShortcut "$SMPROGRAMS\Meeting Translator\Cai VB-Cable.lnk" "$INSTDIR\resources\runtime\vbcable\Install-VB-Cable.bat" "$INSTDIR\resources\runtime\vbcable" "$INSTDIR\Meeting Translator.exe" 0 SW_SHOWNORMAL "" "Cai card am thanh ao VB-Cable (can Admin)"
  vb_no_shortcut:
!macroend

!macro customFinish
  IfFileExists "$INSTDIR\resources\runtime\vbcable\VBCABLE_Setup_x64.exe" 0 vb_missing_file
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Cai VB-Audio Virtual Cable (card am thanh ao)?$\r$\n$\r$\n\
      - Can quyen Administrator (UAC)$\r$\n\
      - Bam «Install Driver» trong cua so setup$\r$\n\
      - Chap nhan cai driver khi Windows hoi$\r$\n\
      - KHOI DONG LAI may sau khi cai$\r$\n$\r$\n\
      Bo qua: Start Menu > Meeting Translator > Cai VB-Cable" \
      IDYES vb_run IDNO vb_after_vb
    vb_run:
      ExecShell "runas" "$INSTDIR\resources\runtime\vbcable\VBCABLE_Setup_x64.exe" ""
      Goto vb_after_vb
  vb_missing_file:
    MessageBox MB_ICONEXCLAMATION|MB_OK \
      "Goi cai khong co file VB-Cable.$\r$\nTai tai https://vb-audio.com/Cable/ hoac cai lai ban moi tu GitHub Releases."
  vb_after_vb:
  MessageBox MB_ICONINFORMATION|MB_OK \
    "Cai dat Meeting Translator hoan tat.$\r$\n$\r$\n\
    1. VB-Cable: neu chua thay CABLE Input/Output trong mmsys.cpl —$\r$\n\
       Start Menu > Cai VB-Cable (can Admin + khoi dong lai)$\r$\n\
    2. Loa Windows mac dinh = CABLE Input (ghi YouTube/Facebook/hop)$\r$\n\
    3. API trong %APPDATA%\meeting-translator-desktop\.env:$\r$\n\
       XAI_API_KEY (Grok) — https://console.x.ai$\r$\n\
       OPENAI_API_KEY (Whisper STT + fallback dich)$\r$\n$\r$\n\
    Xem HUONG_DAN_AM_THANH.txt trong thu muc cai dat." \
    /SD IDOK
!macroend
