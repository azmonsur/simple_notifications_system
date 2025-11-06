# Create and push a new GitHub repo — step by step

1. Open terminal and go to project folder

```bash
cd "C:\Users\Monsur\Desktop\File Manager\Projects\web-development\NIPOST-SNS"
```

2. Initialize repo and set identity (if needed)

```bash
git init
git config user.name "Your Name"
git config user.email "you@example.com"
```

3. Add a README and basic .gitignore (create files if missing)

```bash
echo "# NIPOST-SNS" > README.md
echo "node_modules/\n.env\n.DS_Store" > .gitignore
```

4. Stage and commit

```bash
git add .
git commit -m "Initial commit"
```

5. Create remote repo — choose one:

- Via GitHub website:

  - Go to https://github.com/new, enter repo name (e.g. NIPOST-SNS), Public/Private, Create.
  - Copy the remote URL shown (SSH or HTTPS).

- Via GitHub CLI (recommended if installed):

```bash
gh auth login            # follow prompts once
gh repo create NIPOST-SNS --public --source=. --remote=origin --push
```

6. If using website: add remote and push

```bash
# replace URL with your repo URL
git remote add origin github.com:USERNAME/NIPOST-SNS.git
git branch -M main
git push -u origin main
```

(If you use HTTPS, the URL will be https://github.com/USERNAME/NIPOST-SNS.git — you may be prompted for credentials or use a PAT.)

7. Verify

- Visit https://github.com/USERNAME/NIPOST-SNS to confirm files are present.
- Subsequent work:

```bash
git add .
git commit -m "feat: ..."
git push
```

Notes:

- Use SSH keys or a Personal Access Token (PAT) for authentication if prompted.
- Replace USERNAME and repo name where indicated.
- Adjust .gitignore for your tech stack (Python, Node, etc.).
