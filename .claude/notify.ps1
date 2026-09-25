<#
  Claude Code 훅이 부르는 윈도우 알림 스크립트.

  - 윈도우 기본 토스트 알림(오른쪽 아래 팝업) + 알림음
  - 추가 모듈 설치 없이 윈도우에 원래 있는 기능만 쓴다
  - 토스트가 안 되는 환경이면 작업표시줄 풍선 알림으로 내려간다
  - 어떤 경우에도 오류로 끝내지 않는다 (훅이 작업을 막으면 안 되므로)

  사용법:
    powershell -NoProfile -ExecutionPolicy Bypass -File .claude\notify.ps1 -HookEvent Stop
    powershell -NoProfile -ExecutionPolicy Bypass -File .claude\notify.ps1 -Title "제목" -Message "내용"
#>

[CmdletBinding()]
param(
  # 훅 이름. 여기에 맞는 문구를 아래 표에서 고른다.
  [string]$HookEvent = "",
  [string]$Title = "",
  [string]$Message = ""
)

# 훅 이름 -> 보여 줄 문구.
# 한글을 명령줄로 넘기면 코드페이지 때문에 깨질 수 있어서 문구는 이 파일에 둔다.
$Presets = @{
  "Stop"         = @{ Title = "job-planner"; Message = "job-planner: 작업 완료" }
  "Notification" = @{ Title = "job-planner"; Message = "job-planner: 확인 필요" }
  "Test"         = @{ Title = "job-planner"; Message = "job-planner: 테스트 알림입니다" }
}

if ($HookEvent -and $Presets.ContainsKey($HookEvent)) {
  if (-not $Title)   { $Title   = $Presets[$HookEvent].Title }
  if (-not $Message) { $Message = $Presets[$HookEvent].Message }
}
if (-not $Title)   { $Title   = "job-planner" }
if (-not $Message) { $Message = "알림" }

# XML 에 그대로 넣기 때문에 &, <, > 는 바꿔 준다.
function ConvertTo-XmlText([string]$text) {
  return $text.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
}

$shown = $false

# --- 1순위: 윈도우 10/11 기본 토스트 알림 ---
try {
  [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
  [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime]

  $xml = @"
<toast activationType="protocol" launch="">
  <visual>
    <binding template="ToastGeneric">
      <text>$(ConvertTo-XmlText $Title)</text>
      <text>$(ConvertTo-XmlText $Message)</text>
    </binding>
  </visual>
  <audio src="ms-winsoundevent:Notification.Default" />
</toast>
"@

  $doc = New-Object Windows.Data.Xml.Dom.XmlDocument
  $doc.LoadXml($xml)

  # 윈도우는 시작 메뉴에 등록된 앱 이름(AppUserModelID)으로만 토스트를 띄운다.
  # PowerShell 자체의 ID 를 빌려 쓰면 따로 등록할 것이 없다.
  $appId = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
  $toast = New-Object Windows.UI.Notifications.ToastNotification $doc
  [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)

  $shown = $true
} catch {
  $shown = $false
}

# --- 2순위: 작업표시줄 풍선 알림 ---
if (-not $shown) {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $icon = New-Object System.Windows.Forms.NotifyIcon
    $icon.Icon = [System.Drawing.SystemIcons]::Information
    $icon.BalloonTipTitle = $Title
    $icon.BalloonTipText = $Message
    $icon.Visible = $true
    $icon.ShowBalloonTip(5000)

    # 풍선이 뜨는 동안만 아이콘을 남겨 둔다.
    Start-Sleep -Milliseconds 6000
    $icon.Visible = $false
    $icon.Dispose()

    $shown = $true
  } catch {
    $shown = $false
  }

  # 풍선 알림에는 소리가 없으므로 따로 낸다.
  try { [System.Media.SystemSounds]::Asterisk.Play() } catch { }
}

# 훅은 실패해도 조용히 끝낸다.
exit 0
