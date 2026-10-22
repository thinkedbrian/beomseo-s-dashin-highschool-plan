@echo off
chcp 65001 >nul
cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=5577

echo.
echo   2학기 일정 수첩
echo   ----------------------------------------
echo   주소 : http://localhost:%PORT%
echo.
echo   잠시 뒤 브라우저가 저절로 열립니다.
echo   다 쓰고 나면 이 검은 창을 닫으세요. (사이트도 같이 꺼집니다)
echo.
echo   "Address already in use" 가 보이면 이미 켜져 있다는 뜻이니
echo   위 주소로 그냥 들어가면 됩니다.
echo   ----------------------------------------
echo.

start "" http://localhost:%PORT%
python -m http.server %PORT%

echo.
echo 서버가 멈췄습니다. 아무 키나 누르면 창이 닫힙니다.
pause >nul
