!macro customInit
  ; Đóng app nếu đang chạy — tránh lỗi ghi đè file khi nâng cấp
  nsExec::ExecToStack 'cmd /c tasklist /FI "IMAGENAME eq Meeting Translator.exe" 2>nul | find /I "Meeting Translator.exe"'
  Pop $0
  Pop $1
  StrCmp $1 "" skip_kill 0
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION \
      "Cập nhật Meeting Translator.$\r$\n$\r$\n\
      Ứng dụng đang chạy sẽ được đóng tự động.$\r$\n\
      Bấm Hủy nếu muốn tự đóng app trước (khay hệ thống / Task Manager)." \
      /SD IDOK IDOK do_kill IDCANCEL user_abort
    user_abort:
      Abort "Hãy đóng Meeting Translator rồi chạy lại file cài."
    do_kill:
      nsExec::Exec 'taskkill /F /IM "Meeting Translator.exe" /T'
      Pop $0
      Sleep 2000
  skip_kill:
!macroend

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
       OPENAI_API_KEY (Whisper STT + dich ChatGPT)$\r$\n$\r$\n\
    Xem HUONG_DAN_AM_THANH.txt trong thu muc cai dat." \
    /SD IDOK
!macroend
