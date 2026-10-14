# 夏希漢化公告接口（schema_version 1）

正式公告來源：

- Feed：`https://aaroncsic-bit.github.io/xiaki-ge-mirror/data/notices.json`
- JSON Schema：`https://aaroncsic-bit.github.io/xiaki-ge-mirror/data/notices.schema.json`

## 公告識別與生命週期

- `id`：公告建立後永久固定。
- `revision`：同一公告的管理器可見內容變更時加一。
- `status`：`published` 或 `withdrawn`。
- `withdrawn_at`：公告撤回時間；撤回資料會保留，管理器應隱藏公告。
- `content_hash`：公告管理器可見內容的 SHA-256 雜湊。
- 管理器以 `id + revision` 判斷公告是否已讀或已更新。

## 分類

| `category` | 用途 | `server_scope` | `sea_release_status` |
| --- | --- | --- | --- |
| `kr_update` | 韓版更新與活動 | `KR` | `unconfirmed` |
| `sea_event` | SEA 活動 | `SEA` | `confirmed` |
| `sea_maintenance` | SEA 維修 | `SEA` | `confirmed` |
| `xiaki_general` | 夏希漢化一般公告 | `XIAXI` | `not_applicable` |
| `xiaki_release` | 夏希漢化正式發布公告 | `XIAXI` | `not_applicable` |

韓版資訊不得依標題推斷為 SEA 已推出內容，應一律依 `server_scope` 與 `sea_release_status` 判斷。

## 日期

- 歷史公告只有日期時：`published_at` 為 `null`、`published_date` 為 `YYYY-MM-DD`、`published_precision` 為 `date`。
- 已知精確發布時間時：`published_at` 使用含時區的 ISO 8601、`published_precision` 為 `datetime`。
- 不得替歷史公告虛構發布時刻。

## SEA 維修時間

`sea_maintenance` 公告會額外提供可選欄位 `maintenance_windows`。此陣列由網站既有維修公告區塊自動產生，不是第二份人工維護資料。

| 欄位 | 說明 |
| --- | --- |
| `timezone_code` | 網站顯示的時區代碼，目前為 `SGT`、`EST`、`CET`。 |
| `timezone_label` | 網站顯示的中文時區名稱。 |
| `date` | 該時區的維修日期，格式為 `YYYY-MM-DD`。 |
| `start_time` | 該時區的開始時間，格式為 `HH:mm`。 |
| `end_time` | 該時區的結束時間，格式為 `HH:mm`。 |
| `display_text` | 網站原始顯示文字，供管理器需要完全一致呈現時使用。 |

管理器不得自行替這些欄位換算或推測 UTC 位移；應依 `timezone_code`、`date`、`start_time`、`end_time` 顯示。舊版管理器可忽略此新增欄位，因此 `schema_version` 維持 `1`。

## 管理器讀取規則

1. 管理器啟動時檢查一次。
2. 管理器持續開啟期間，每 60 分鐘檢查一次；不需背景常駐。
3. 同一個 `id + revision` 不得反覆彈出提醒。
4. `revision` 增加時可重新標記未讀，但不視為全新公告重複彈出。
5. 網站無法連線或 JSON 暫時無法解析時，保留上次成功取得的公告。
6. `status` 為 `withdrawn` 時隱藏公告並保留撤回狀態。
7. 未知欄位應忽略；不支援的 `schema_version` 應停止套用新資料並保留本機快取。
8. 建議使用 `ETag` 或 `If-Modified-Since` 進行條件式請求。

## 網站發布流程

網站公告仍以 HTML 為唯一編輯來源。GitHub Pages 發布工作會先執行生成器與測試，再部署包含最新 `data/notices.json` 的靜態網站；不需要人工維護第二份公告內容。
