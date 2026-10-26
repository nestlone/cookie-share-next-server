# Cookie Share Next Privacy Policy / 隐私权政策

**Effective date / 生效日期:** October 26, 2026 / 2026 年 10 月 26 日  
**Last updated / 最后更新:** October 26, 2026 / 2026 年 10 月 26 日

This policy applies to the Cookie Share Next browser extension and the official service at `https://cookie.nestlone.com`. A self-hosted server is operated by its own administrator and may have an additional privacy policy.

本政策适用于 Cookie Share Next 浏览器扩展及位于 `https://cookie.nestlone.com` 的官方服务。自托管服务器由相应管理员运营，并可能适用其自己的附加隐私政策。

The public, browser-friendly version of this policy is available at `https://cookie.nestlone.com/privacy/`.

## English

### 1. Purpose

Cookie Share Next lets a user save and switch authorized website login states across the user's browsers. The extension reads a login state only when the user asks it to save or switch an account. Sensitive browser state is encrypted in the extension before synchronization. The service stores encrypted envelopes and cannot decrypt their contents.

### 2. Data the extension accesses

When needed for a user-requested feature, the extension may access:

- the active tab's URL, hostname, title, and icon, to identify the current site and display matching saved accounts;
- cookies for the current site, including HTTPOnly and partitioned cookies where Chromium grants access;
- same-origin `localStorage` and `sessionStorage` for the current site, because some sites require browser storage in addition to cookies;
- extension settings, the server address, the extension login session, and local encryption state;
- files the user explicitly imports or exports as account backups.

The extension does not continuously scan tabs, collect browsing history, inject advertising, or use the accessed data for profiling.

### 3. Data received by the official service

The official service may receive and store:

- an OAuth provider name, provider-specific account identifier, and provider login/display name; for Google sign-in, the displayed login may be the email address returned by Google;
- encrypted account buckets, opaque bucket identifiers, ciphertext sizes, and creation/update timestamps;
- cryptographic hashes of service session tokens and backup login keys; plaintext backup keys are shown to the user once and are not stored by the service;
- short-lived OAuth state and exchange records needed to complete sign-in securely;
- account ID, API endpoint, and timestamp records used to enforce daily request limits and protect the service;
- the requesting IP address for short-lived login rate limiting and abuse prevention;
- technical request metadata processed by Cloudflare while delivering and protecting the official service.

OAuth access tokens are used transiently to request the minimum identity information from the selected provider and are not stored by Cookie Share Next.

### 4. How data is used

We use the data only to:

- authenticate users and link sign-in providers at the user's request;
- synchronize encrypted account buckets;
- enforce storage and request quotas;
- prevent abuse, rate-limit login attempts, maintain service security, and diagnose operational failures;
- provide import, export, account switching, and deletion features requested by the user.

We do not sell personal data. We do not use or transfer user data for personalized advertising, retargeting, credit decisions, or unrelated analytics. We do not allow humans to read decrypted cookies or browser storage because the service does not possess the vault password or decryption keys.

### 5. Encryption and security

Cookie values, saved browser storage, bucket names, and related account-state contents are encrypted inside the extension before upload. The vault password and derived decryption keys remain in the extension and are not sent to the service. The service receives only encrypted envelopes for those contents. Network communication with the official service uses HTTPS.

No system can guarantee absolute security. Users should protect exported backup files, vault passwords, backup login keys, OAuth accounts, and devices that have access to the extension.

### 6. Service providers and disclosures

Data is disclosed only as necessary to provide the extension's single purpose:

- **Cloudflare** hosts and protects the official Worker service and D1 database and processes network and infrastructure metadata.
- **GitHub, Google, or LinuxDo** processes authentication when the user chooses that provider. Each provider applies its own privacy policy.
- **A user-selected self-hosted server** receives encrypted bucket data when the user configures the extension to use that server. Its operator, not Cookie Share Next, controls that deployment.

We may disclose information when required by applicable law or when reasonably necessary to protect users, the service, or the public from security threats or abuse.

### 7. Retention

- Encrypted buckets remain until the user deletes them or the account is deleted.
- OAuth account links and basic account metadata remain while the service account exists.
- Sessions and temporary OAuth records expire according to service configuration and are periodically removed.
- Login-attempt IP records are retained only for rate limiting and are periodically purged after the applicable protection window.
- API request-limit records are normally retained for seven days on the official service.
- Local extension data remains until the user clears it or uninstalls the extension. Exported files remain wherever the user chose to save them.

### 8. User choices and deletion

Users can delete individual encrypted account buckets or all encrypted buckets from the extension, unlink an additional OAuth provider, sign out, reset a backup key, remove local extension data, and uninstall the extension. Uninstalling the extension does not automatically delete server-side data or exported files.

To request deletion of the remaining official-service account identity and associated server records, contact the maintainer through the repository's private security-reporting channel. Do not post cookies, tokens, backup keys, database exports, or other sensitive information in a public issue.

### 9. Children

Cookie Share Next is not directed to children under 13, and we do not knowingly collect personal information from children under 13.

### 10. Chrome Web Store Limited Use

Cookie Share Next's use and transfer of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Data obtained through extension permissions is used only to provide or improve the extension's disclosed, user-facing account-state management features.

### 11. Changes and contact

Material changes will be published at the same public policy URL with an updated date. Questions or privacy requests may be submitted through the private security-reporting channel of the `nestlone/cookie-share-next-server` GitHub repository. Public issues may be used for general, non-sensitive questions only.

## 中文

### 1. 产品用途

Cookie Share Next 用于在用户自己的浏览器之间保存和切换其有权使用的网站登录状态。只有当用户主动要求保存或切换账号时，扩展才会读取登录状态。敏感浏览器状态会在扩展内加密后再同步；服务端只保存加密信封，无法解密其中内容。

### 2. 扩展访问的数据

为完成用户主动请求的功能，扩展可能访问：

- 当前标签页的 URL、主机名、标题和图标，用于识别网站并显示匹配的已保存账号；
- 当前网站的 Cookie，包括 Chromium 允许访问的 HTTPOnly Cookie 和分区 Cookie；
- 当前网站同源的 `localStorage` 与 `sessionStorage`，因为部分网站除 Cookie 外还依赖浏览器存储；
- 扩展设置、服务器地址、扩展登录会话和本地加密状态；
- 用户明确选择导入或导出的账号备份文件。

扩展不会持续扫描标签页、收集浏览历史、注入广告，也不会使用上述数据建立用户画像。

### 3. 官方服务接收的数据

官方服务可能接收和保存：

- OAuth 提供商名称、该提供商分配的账号标识符以及登录名或显示名称；使用 Google 登录时，显示的登录名可能是 Google 返回的电子邮箱地址；
- 加密账号桶、不透明的桶标识符、密文大小以及创建和更新时间；
- 服务会话令牌和备用登录密钥的密码学哈希；备用登录密钥明文仅向用户显示一次，服务端不保存明文；
- 安全完成登录所需的短期 OAuth 状态和交换记录；
- 用于执行每日请求限制和保护服务的账号 ID、API 路径及时间戳记录；
- 用于短期限流和防止滥用的请求 IP 地址；
- Cloudflare 在交付和保护官方服务时处理的技术请求元数据。

OAuth 访问令牌仅临时用于向用户选择的提供商请求最少量身份信息，Cookie Share Next 不会保存该访问令牌。

### 4. 数据用途

我们仅将数据用于：

- 验证用户身份，以及按照用户请求关联登录提供商；
- 同步加密账号桶；
- 执行存储及请求配额；
- 防止滥用、限制登录尝试、维护服务安全和排查运行故障；
- 提供用户主动请求的导入、导出、账号切换和删除功能。

我们不会出售个人数据，不会将用户数据用于或转移给个性化广告、重新定向广告、信贷决策或无关分析。服务端不持有保险库密码或解密密钥，因此我们无法安排人工读取已解密的 Cookie 或浏览器存储内容。

### 5. 加密与安全

Cookie 值、已保存的浏览器存储、桶名称及相关账号状态内容会在上传前于扩展内加密。保险库密码及派生解密密钥保留在扩展内，不会发送到服务端。服务端仅接收这些内容的加密信封。与官方服务之间的网络通信使用 HTTPS。

任何系统都无法保证绝对安全。用户应妥善保护导出的备份文件、保险库密码、备用登录密钥、OAuth 账号以及能够访问扩展的设备。

### 6. 服务提供商与数据披露

仅在实现扩展单一用途所必需的范围内披露数据：

- **Cloudflare** 托管并保护官方 Worker 服务和 D1 数据库，同时处理网络及基础设施元数据；
- **GitHub、Google 或 LinuxDo** 在用户选择相应方式时处理身份验证，并适用各自的隐私政策；
- 当用户配置扩展连接到**用户选择的自托管服务器**时，该服务器会接收加密账号桶；该部署由其运营者而非 Cookie Share Next 控制。

在适用法律要求，或为保护用户、服务及公众免受安全威胁或滥用而具有合理必要性时，我们可能披露相关信息。

### 7. 保存期限

- 加密账号桶会保留至用户删除或账号被删除；
- OAuth 账号关联及基础账号元数据会在服务账号存在期间保留；
- 会话及临时 OAuth 记录依据服务配置到期，并定期清理；
- 登录尝试的 IP 记录仅用于限流，并在相应保护窗口结束后定期清理；
- 官方服务的 API 请求限额记录通常保存七天；
- 扩展本地数据会保留至用户清除或卸载扩展；导出文件会保留在用户选择的保存位置。

### 8. 用户选择与删除

用户可以在扩展中删除单个或全部加密账号桶、解除附加 OAuth 提供商的关联、退出登录、重置备用登录密钥、删除扩展本地数据或卸载扩展。卸载扩展不会自动删除服务端数据或用户导出的文件。

如需删除官方服务中剩余的账号身份及相关服务端记录，请通过 GitHub 仓库的私密安全报告渠道联系维护者。请勿在公开 Issue 中发布 Cookie、令牌、备用密钥、数据库导出或其他敏感信息。

### 9. 儿童隐私

Cookie Share Next 并非面向 13 岁以下儿童，我们不会故意收集 13 岁以下儿童的个人信息。

### 10. Chrome 网上应用店 Limited Use

Cookie Share Next 对从 Google API 获得的信息的使用和转移遵守 Chrome Web Store User Data Policy，包括 Limited Use 要求。通过扩展权限取得的数据仅用于提供或改进已公开说明、面向用户的账号状态管理功能。

### 11. 政策变更与联系方式

如发生重大变更，我们会在同一公开隐私政策 URL 发布更新并修改日期。隐私问题或请求可通过 `nestlone/cookie-share-next-server` GitHub 仓库的私密安全报告渠道提交；普通且不敏感的问题可以使用公开 Issue。
