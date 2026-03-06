import os

def generate_tree(dir_path, prefix=""):
    exclude_dirs = {'node_modules', 'venv', '.git', '__pycache__', 'dist', 'build', '.idea', '.vscode', '.next'}
    
    try:
        items = os.listdir(dir_path)
    except PermissionError:
        return
        
    dirs = [d for d in items if os.path.isdir(os.path.join(dir_path, d)) and d not in exclude_dirs]
    files = [f for f in items if os.path.isfile(os.path.join(dir_path, f))]
    dirs.sort()
    files.sort()
    
    entries = dirs + files
    for i, entry in enumerate(entries):
        is_last = (i == len(entries) - 1)
        connector = "└── " if is_last else "├── "
        print(f"{prefix}{connector}{entry}")
        
        if entry in dirs:
            extension = "    " if is_last else "│   "
            generate_tree(os.path.join(dir_path, entry), prefix + extension)

print("Milestone_2/")
generate_tree(r"C:\Users\kpriy\Desktop\Milestone2\Milestone_2")
