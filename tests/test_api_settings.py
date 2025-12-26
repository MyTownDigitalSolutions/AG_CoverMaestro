import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.core import ExportSetting
from app.api.settings import get_export_settings, update_export_settings
from app.schemas.core import ExportSettingCreate

class TestExportSettings(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()

    def test_get_export_settings_defaults(self):
        """Test that fetching settings creates a default if none exists"""
        # Ensure DB is empty
        self.assertEqual(self.db.query(ExportSetting).count(), 0)

        # Call the GET handler
        settings = get_export_settings(db=self.db)
        
        # Verify default creation
        self.assertIsNotNone(settings)
        self.assertEqual(self.db.query(ExportSetting).count(), 1)
        self.assertEqual(settings.default_save_path_template, "")

    def test_update_export_settings(self):
        """Test updating the export settings"""
        # Create initial setting
        initial = ExportSetting(default_save_path_template="old_path")
        self.db.add(initial)
        self.db.commit()

        # Update
        new_path = "C:\\NewPath\\[Manufacturer]"
        update_data = ExportSettingCreate(default_save_path_template=new_path)
        
        updated = update_export_settings(data=update_data, db=self.db)
        
        # Verify response
        self.assertEqual(updated.default_save_path_template, new_path)
        
        # Verify DB persistence
        db_record = self.db.query(ExportSetting).first()
        self.assertEqual(db_record.default_save_path_template, new_path)

    def test_route_registration(self):
        """Verify routes are registered"""
        from app.main import app
        
        routes_to_check = [
            ("/settings/export", "GET"),
            ("/settings/export", "PUT")
        ]
        
        for check_path, check_method in routes_to_check:
            found = False
            for route in app.routes:
                path = getattr(route, "path", None)
                if path == check_path:
                    methods = getattr(route, "methods", set())
                    if check_method in methods:
                        found = True
                        break
            self.assertTrue(found, f"Route {check_method} {check_path} not found")

if __name__ == '__main__':
    unittest.main()
