!macro customInstall
  IfFileExists "$INSTDIR\resources\runtime\vbcable\VBCABLE_Setup_x64.exe" 0 vb_skip
    DetailPrint "Cai VB-Audio Virtual Cable (card am thanh ao)..."
    ExecWait '"$INSTDIR\resources\runtime\vbcable\VBCABLE_Setup_x64.exe" /S' $0
    IntCmp $0 0 vb_ok vb_warn vb_warn
  vb_ok:
    DetailPrint "VB-Cable cai dat thanh cong."
    Goto vb_done
  vb_warn:
    DetailPrint "VB-Cable: can quyen Admin — chay thu cong neu can."
    Goto vb_done
  vb_skip:
    DetailPrint "Bo qua VB-Cable (khong co file setup)."
  vb_done:
!macroend

!macro customFinish
  MessageBox MB_ICONINFORMATION|MB_OK \
    "Cai dat Meeting Translator hoan tat.$\r$\n$\r$\n\
    1. VB-Cable: dat loa Windows mac dinh = CABLE Input de ghi YouTube/Facebook/hop — xem HUONG_DAN_AM_THANH.txt$\r$\n\
    2. Dien API trong %APPDATA%\meeting-translator-desktop\.env:$\r$\n\
       XAI_API_KEY (Grok) — https://console.x.ai$\r$\n\
       OPENAI_API_KEY (Whisper STT + fallback dich)$\r$\n$\r$\n\
    Live meeting: Grok uu tien, het quota tu chuyen ChatGPT." \
    /SD IDOK
!macroend
