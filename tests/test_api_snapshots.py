import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.core import Model, Series, Manufacturer, EquipmentType
from app.api.pricing import check_snapshot_status, PricingSnapshotStatusRequest

# Setup In-Memory DB
class TestSnapshotStatus(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()

    def test_import_registry_check(self):
        """
        Just importing the module (done above) validates that all types (Dict, List) 
        are correctly imported. If this test runs, any ImportErrors/NameErrors 
        at module level would have already raised.
        """
        pass

    def test_empty_request(self):
        """Test with empty list of models"""
        req = PricingSnapshotStatusRequest(model_ids=[], marketplace="amazon")
        # Call function directly, injecting db session
        resp = check_snapshot_status(req, db=self.db)
        
        self.assertEqual(resp.missing_snapshots, {})
        self.assertTrue(resp.complete)

    def test_missing_snapshots(self):
        """Test with a model that has no snapshots"""
        # Create Data
        mfr = Manufacturer(name="Mfr1")
        self.db.add(mfr)
        self.db.commit()
        
        series = Series(name="S1", manufacturer_id=mfr.id)
        self.db.add(series)
        self.db.commit()
        
        eq = EquipmentType(name="Eq1")
        self.db.add(eq)
        self.db.commit()
        
        model = Model(
            name="Model1", 
            series_id=series.id, 
            equipment_type_id=eq.id,
            width=10, depth=10, height=10
        )
        self.db.add(model)
        self.db.commit()
        
        # Test
        req = PricingSnapshotStatusRequest(model_ids=[model.id], marketplace="amazon")
        resp = check_snapshot_status(req, db=self.db)
        
        # Should be missing
        self.assertIn(model.id, resp.missing_snapshots)
        self.assertFalse(resp.complete)

    def test_route_exec_smoke(self):
        """
        Smoke test verifying the route handler executes securely through the logic layer.
        Since we don't have TestClient/httpx, we manually instantiate the Pydantic model
        and call the function. This catches Pydantic validation errors and schema mismatches.
        """
        # 1. Instantiate Request Model (simulates Pydantic parsing incoming JSON)
        raw_payload = {"model_ids": [], "marketplace": "amazon"}
        req_model = PricingSnapshotStatusRequest(**raw_payload)

        # 2. Call Handler (simulates FastAPI routing to the function)
        # We pass our valid db session.
        resp_model = check_snapshot_status(req_model, db=self.db)

        # 3. Validate Response Model (simulates Pydantic serializing the result)
        # We access the fields to ensure expected output structure.
        self.assertIsInstance(resp_model.missing_snapshots, dict)
        self.assertIsInstance(resp_model.complete, bool)
        self.assertEqual(resp_model.missing_snapshots, {})
        self.assertEqual(resp_model.complete, True)

    def test_route_is_registered(self):
        """
        Verifies that the API route is actually registered in the application.
        This catches regressions where the router is accidentally removed from main.py
        or the path/method is changed.
        """
        from app.main import app
        
        target_path = "/pricing/snapshots/status"
        found = False
        
        for route in app.routes:
            # Attribute check handles potential differences in Mounts vs APIRoutes
            path = getattr(route, "path", None)
            if path == target_path:
                methods = getattr(route, "methods", set())
                if "POST" in methods:
                    found = True
                    break
        
        self.assertTrue(found, f"Route POST {target_path} not found in app.routes")

    def test_status_logs_info(self):
        """
        Verifies that check_snapshot_status emits the expected INFO log line.
        """
        req = PricingSnapshotStatusRequest(model_ids=[], marketplace="amazon")
        
        # 'app.api.pricing' is the logger name since it's logging.getLogger(__name__) inside app/api/pricing.py
        with self.assertLogs("app.api.pricing", level="INFO") as cm:
            check_snapshot_status(req, db=self.db)
            
        # Assert message content
        # We expect: "[SNAPSHOTS-STATUS] Checking 0 models for marketplace amazon"
        self.assertTrue(any("[SNAPSHOTS-STATUS] Checking 0 models" in output for output in cm.output),
                        f"Expected log message not found. Got: {cm.output}")

if __name__ == '__main__':
    unittest.main()
